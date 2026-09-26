import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { getInstalledBrowsers } from './browser'

// yt-dlp cookie 策略：
// 直接 --cookies-from-browser 在浏览器运行时常失败（Windows 下 Chrome 锁库 / App-Bound 加密、
// macOS 钥匙串等），且一旦失败整个解析/下载都会报错。这里按顺序尝试多个 cookie 来源，
// 并把成功读取的浏览器 cookie 导出为快照，供后续下载直接复用（也省去每次解密的耗时）。

export interface CookieAttempt {
  label: string
  /** 真正执行这次尝试时才调用，返回 yt-dlp 的 cookie 参数 */
  prepare: () => string[]
  /** yt-dlp 成功结束后调用 */
  onSuccess: () => void
  /** 本次尝试因 cookie 读取失败而放弃时调用 */
  onCookieFailure: () => void
  /** 无论成败都要调用，清理临时文件 */
  cleanup: () => void
}

const SNAPSHOT_FRESH_MS = 30 * 60 * 1000
const BROWSER_FAILURE_TTL_MS = 10 * 60 * 1000

let lastGoodBrowser = ''
const browserFailures = new Map<string, number>()

function cookieDir(): string {
  const dir = path.join(app.getPath('userData'), 'cookies')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function snapshotPath(): string {
  return path.join(cookieDir(), 'browser-cookies.txt')
}

function tempPath(tag: string): string {
  return path.join(cookieDir(), `tmp-${tag}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`)
}

function removeQuietly(file: string) {
  try { fs.rmSync(file, { force: true }) } catch {}
}

function snapshotAge(): number | null {
  try { return Date.now() - fs.statSync(snapshotPath()).mtimeMs } catch { return null }
}

// yt-dlp 退出时会把 cookie 写回 --cookies 指定的文件，并发任务共用同一文件会互相覆盖，
// 所以每次运行都使用快照的独立副本
function snapshotAttempt(label: string): CookieAttempt {
  const copy = tempPath('snap')
  return {
    label,
    prepare: () => {
      try { fs.copyFileSync(snapshotPath(), copy); return ['--cookies', copy] } catch { return [] }
    },
    onSuccess: () => {},
    onCookieFailure: () => {},
    cleanup: () => removeQuietly(copy),
  }
}

function browserAttempt(browser: string): CookieAttempt {
  // 与 --cookies-from-browser 同时指定一个尚不存在的 --cookies 文件，yt-dlp 退出时会把读到的
  // 浏览器 cookie 写入该文件，成功后原子替换为快照
  const exported = tempPath(browser)
  return {
    label: browser,
    prepare: () => ['--cookies-from-browser', browser, '--cookies', exported],
    onSuccess: () => {
      lastGoodBrowser = browser
      browserFailures.delete(browser)
      try {
        if (fs.statSync(exported).size > 0) {
          fs.renameSync(exported, snapshotPath())
          if (process.platform !== 'win32') fs.chmodSync(snapshotPath(), 0o600)
        }
      } catch {}
    },
    onCookieFailure: () => {
      browserFailures.set(browser, Date.now())
      if (lastGoodBrowser === browser) lastGoodBrowser = ''
    },
    cleanup: () => removeQuietly(exported),
  }
}

const noCookies = (): CookieAttempt => ({
  label: 'none', prepare: () => [], onSuccess: () => {}, onCookieFailure: () => {}, cleanup: () => {},
})

/**
 * 生成按顺序尝试的 cookie 来源。
 * - 手动模式：用户导入的 cookies.txt → 无 cookie
 * - 自动模式（解析）：各浏览器（上次成功的优先）→ 快照 → 无 cookie
 * - 自动模式（下载，preferSnapshot）：新鲜快照 → 各浏览器 → 旧快照 → 无 cookie
 *   解析刚刷新过快照，下载直接复用可保证两者 cookie 一致，并跳过浏览器解密
 */
export function getCookieAttempts(manualFile?: string, preferSnapshot = false): CookieAttempt[] {
  if (manualFile && fs.existsSync(manualFile)) {
    return [{ ...noCookies(), label: 'manual', prepare: () => ['--cookies', manualFile] }, noCookies()]
  }

  const attempts: CookieAttempt[] = []
  const age = snapshotAge()
  const fresh = age !== null && age < SNAPSHOT_FRESH_MS

  if (preferSnapshot && fresh) attempts.push(snapshotAttempt('snapshot'))

  const now = Date.now()
  const browsers = getInstalledBrowsers()
    .filter(b => now - (browserFailures.get(b) || 0) > BROWSER_FAILURE_TTL_MS)
    .sort((a, b) => Number(b === lastGoodBrowser) - Number(a === lastGoodBrowser))
  attempts.push(...browsers.map(browserAttempt))

  if (age !== null && !(preferSnapshot && fresh)) attempts.push(snapshotAttempt('snapshot'))
  attempts.push(noCookies())
  return attempts
}

// 只认 cookie 加载阶段的错误；YouTube 的 "Use --cookies-from-browser or --cookies for the
// authentication" 属于需要登录，不是读取失败，换 cookie 来源没有意义
const COOKIE_ERROR_PATTERNS = [
  /could not (?:find|copy) \S+ cookie/i,
  /failed to (?:decrypt|load cookies)/i,
  /cookies? database/i,
  /keyring|keychain|secretstorage|kwallet/i,
  /unsupported (?:browser|keyring)/i,
  /database is locked|unable to open database/i,
  /netscape format|invalid (?:length|expires)/i,
]

export function isCookieError(stderr: string): boolean {
  return stderr.split('\n').some(line =>
    line.startsWith('ERROR:')
    && !line.includes('--cookies-from-browser or --cookies')
    && COOKIE_ERROR_PATTERNS.some(p => p.test(line)))
}

/**
 * 按 cookie 策略依次执行 yt-dlp，只有 cookie 读取失败才换下一个来源；
 * 其他错误（包括暂停导致的中断）直接返回，交给调用方处理
 */
export async function runWithCookies<R extends { code: number | null; stderr: string }>(
  attempts: CookieAttempt[],
  run: (cookieArgs: string[], attempt: CookieAttempt) => Promise<R>,
): Promise<R> {
  let result: R | undefined
  for (const attempt of attempts) {
    try {
      result = await run(attempt.prepare(), attempt)
      if (result.code === 0) { attempt.onSuccess(); return result }
      if (!isCookieError(result.stderr)) return result
      attempt.onCookieFailure()
    } finally {
      attempt.cleanup()
    }
  }
  return result!
}

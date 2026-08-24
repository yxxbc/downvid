import { spawn } from 'node:child_process'
import path from 'node:path'
import { getYtDlpPath, checkJsRuntime } from '../utils/binary'
import { getAvailableBrowser } from '../utils/browser'
import { LANG_NAMES } from '../constants'
import fs from 'node:fs'
import os from 'node:os'

// 解析结果缓存
const PARSE_CACHE_VERSION = 3
const parseCache = new Map<string, { data: any; time: number; ver: number }>()
const PARSE_CACHE_TTL = 30 * 60 * 1000

function buildBaseArgs(isYoutube: boolean): string[] {
  const args = [
    '--no-playlist', '--no-check-certificates', '--no-warnings', '--quiet',
    '--socket-timeout', '10', '--extractor-retries', '1',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '--add-header', 'Accept-Language:en-US,en;q=0.9',
  ]
  if (isYoutube) args.push('--extractor-args', 'youtube:skip=hls,dash')
  return args
}

function applyCookies(args: string[], cookiesFile?: string) {
  if (cookiesFile && fs.existsSync(cookiesFile)) {
    args.push('--cookies', cookiesFile)
  } else {
    const browser = getAvailableBrowser()
    if (browser) args.push('--cookies-from-browser', browser)
  }
}

function applyProxy(args: string[], proxy?: string) {
  if (proxy) args.push('--proxy', proxy)
}

function applyYoutubeRuntime(args: string[]) {
  const runtimeCheck = checkJsRuntime()
  if (runtimeCheck.path) {
    const isNode = runtimeCheck.path.includes('node')
    args.push('--js-runtimes', `${isNode ? 'node' : 'deno'}:${runtimeCheck.path}`)
  }
}

// 快速预取：只拿标题+缩略图+时长，不拿格式列表
export function prefetchMetadata(url: string, cookiesFile?: string, proxy?: string): Promise<any> {
  const isYoutube = url.includes('youtube.com') || url.includes('youtu.be')
  const args = [
    ...buildBaseArgs(isYoutube),
    '--print', '%()j',
    '--no-download',
  ]
  applyCookies(args, cookiesFile)
  applyProxy(args, proxy)
  if (isYoutube) applyYoutubeRuntime(args)
  args.push(url)

  const ytdlpPath = getYtDlpPath()
  const cwd = path.dirname(ytdlpPath)
  const child = spawn(ytdlpPath, args, { cwd })
  let output = ''
  let errorOutput = ''

  child.stdout?.on('data', (d: Buffer) => { output += d.toString() })
  child.stderr?.on('data', (d: Buffer) => { errorOutput += d.toString() })

  return new Promise((resolve) => {
    const timeout = setTimeout(() => { child.kill(); resolve(null) }, 8000)
    child.on('close', () => {
      clearTimeout(timeout)
      try {
        const info = JSON.parse(output)
        resolve({
          id: info.id || '',
          title: info.title || '未知标题',
          thumbnail: info.thumbnail || '',
          duration: info.duration || 0,
          uploader: info.uploader || '',
          webpageUrl: info.webpage_url || url,
        })
      } catch { resolve(null) }
    })
    child.on('error', () => { clearTimeout(timeout); resolve(null) })
  })
}

// 完整解析：拿格式列表（优先用守护进程，回退到 yt-dlp CLI）
export async function parseWithYtdlp(url: string, cookiesFile?: string, proxy?: string): Promise<any> {
  const cacheKey = `${url}|${cookiesFile || ''}|${proxy || ''}`
  const cached = parseCache.get(cacheKey)
  if (cached && cached.ver === PARSE_CACHE_VERSION && Date.now() - cached.time < PARSE_CACHE_TTL) {
    return cached.data
  }

  // 直接使用 CLI（自带 yt-dlp 二进制），不启动常驻 daemon：避免常驻 Python 内存占用与版本不一致
  return parseViaCli(url, cookiesFile, proxy, cacheKey)
}

function cleanupCache() {
  for (const [key, val] of parseCache) {
    if (val.ver !== PARSE_CACHE_VERSION || Date.now() - val.time > PARSE_CACHE_TTL) parseCache.delete(key)
  }
}

function parseViaCli(url: string, cookiesFile: string | undefined, proxy: string | undefined, cacheKey: string): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const ytdlpPath = getYtDlpPath()
    const isYoutube = url.includes('youtube.com') || url.includes('youtu.be')

    const args = [
      ...buildBaseArgs(isYoutube),
      isYoutube ? '--print' : '--dump-json',
      isYoutube ? '%()j' : '',
    ].filter(Boolean)
    applyCookies(args, cookiesFile)
    applyProxy(args, proxy)
    if (isYoutube) applyYoutubeRuntime(args)
    args.push(url)

    const cwd = path.dirname(ytdlpPath)
    const child = spawn(ytdlpPath, args, { cwd })
    let output = ''
    let errorOutput = ''

    child.stdout?.on('data', (d: Buffer) => { output += d.toString() })
    child.stderr?.on('data', (d: Buffer) => { errorOutput += d.toString() })

    child.on('close', (code) => {
      if (code !== 0) { reject(new Error(errorOutput || '解析失败')); return }

      try {
        const info = JSON.parse(output)

        function getResolutionLabel(height: number, fps: number): string {
          let label = ''
          if (height >= 2160) label = '4K'
          else if (height >= 1440) label = '2K'
          else if (height >= 1080) label = '1080P'
          else if (height >= 720) label = '720P'
          else if (height >= 480) label = '480P'
          else if (height >= 360) label = '360P'
          else if (height >= 240) label = '240P'
          else label = `${height}P`
          if (fps > 30) label += ` ${fps}fps`
          return label
        }

        function cleanQualityLabel(raw: string): string {
          if (!raw) return ''
          const s = raw.trim()
          if (/^\d{3,4}x\d{3,4}$/.test(s)) return ''
          if (/^\d+$/.test(s)) return ''
          const heightMatch = s.match(/(\d{3,4})\s*p/i)
          if (heightMatch) {
            const h = parseInt(heightMatch[1])
            const fpsMatch = s.match(/(\d{3,4})\s*p[_\s]*(\d+)\s*(?:fps)?/i)
            const fps = fpsMatch ? parseInt(fpsMatch[2]) : 0
            let label = ''
            if (h >= 2160) label = '4K'
            else if (h >= 1440) label = '2K'
            else label = `${h}P`
            if (fps > 30) label += ` ${fps}fps`
            return label
          }
          return ''
        }

        let formats = (info.formats || [])
          .filter((f: any) => f.vcodec !== 'none' && f.vcodec && f.height && f.height > 0 && !(f.protocol || '').includes('m3u8'))
          .map((f: any) => {
            let filesize = f.filesize || f.filesize_approx || 0
            if (!filesize && info.duration) {
              let bitrate = f.tbr || 0
              if (!bitrate) { bitrate = (f.vbr || 0) + (f.abr || (f.acodec && f.acodec !== 'none' ? 128 : 0)) }
              if (bitrate > 0) filesize = Math.floor((bitrate * 1000 * info.duration) / 8)
            }
            const height = f.height || 0
            const fps = f.fps || 0
            const rawLabel = cleanQualityLabel(f.quality_label || '') || cleanQualityLabel(f.format_note || '')
            const quality = rawLabel || getResolutionLabel(height, fps)
            return {
              formatId: f.format_id || '', quality,
              ext: f.ext || f.video_ext || 'mp4', filesize,
              width: f.width || 0, height, fps,
              hasAudio: f.acodec && f.acodec !== 'none',
              _tbr: f.tbr || 0, _vbr: f.vbr || 0,
            }
          })
          .sort((a: any, b: any) => (b.height || 0) - (a.height || 0) || (b._tbr || 0) - (a._tbr || 0))
          .filter((f: any, i: number, self: any[]) => {
            const key = `${f.quality}_${f.fps || 0}`
            const first = self.findIndex((t: any) => `${t.quality}_${t.fps || 0}` === key)
            if (i === first) return true
            if ((f._tbr || 0) > (self[first]._tbr || 0)) { self[first] = { ...self[first], _remove: true }; return true }
            return false
          })
          .filter((f: any) => !f._remove)
          .map(({ _tbr, _vbr, _remove, ...rest }: any) => rest) || []

        // YouTube 多音轨
        const audioTracks: any[] = []
        if (isYoutube && info.formats) {
          const m3u8Best: Record<string, any> = {}
          for (const f of info.formats.filter((f: any) => f.protocol?.includes('m3u8') && f.language)) {
            const lang = f.language
            if (!lang) continue
            if (!m3u8Best[lang] || (f.height || 0) > (m3u8Best[lang].height || 0)) {
              m3u8Best[lang] = { formatId: f.format_id, lang, height: f.height || 0 }
            }
          }
          if (Object.keys(m3u8Best).length > 1) {
            for (const [lang, best] of Object.entries(m3u8Best)) {
              audioTracks.push({ id: lang, name: LANG_NAMES[lang] || lang.toUpperCase(), language: lang, formatId: best.formatId, isM3u8: true })
            }
          } else {
            const langBest: Record<string, any> = {}
            for (const f of info.formats.filter((f: any) => f.vcodec === 'none' && f.acodec && f.acodec !== 'none')) {
              const lang = f.language
              if (!lang) continue
              if (!langBest[lang] || (f.abr || 0) > (langBest[lang].abr || 0)) langBest[lang] = { formatId: f.format_id, lang, abr: f.abr || 0 }
            }
            for (const [lang, best] of Object.entries(langBest)) {
              audioTracks.push({ id: lang, name: LANG_NAMES[lang] || lang.toUpperCase(), language: lang, formatId: best.formatId })
            }
          }
        }

        const subtitles = Object.keys(info.subtitles || {}).map((lang: string) => {
          const sub = info.subtitles[lang]
          const first = Array.isArray(sub) ? sub[0] : sub
          return { language: lang, name: first?.name || lang, url: first?.url || '' }
        })

        const audioFormats = isYoutube && info.formats ? info.formats
          .filter((f: any) => f.vcodec === 'none' && f.acodec && f.acodec !== 'none')
          .map((f: any) => ({ formatId: f.format_id || '', quality: f.abr ? `${f.abr}kbps` : (f.format_note || '音频'), ext: f.ext || f.audio_ext || 'm4a', filesize: f.filesize || f.filesize_approx || 0, abr: f.abr || 0, acodec: f.acodec || '' }))
          .filter((f: any, i: number, self: any[]) => self.findIndex((t: any) => t.abr === f.abr) === i)
          .sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0)).slice(0, 6) : []

        const result: any = {
          id: info.id || '', title: info.title || '未知标题', description: info.description || '',
          thumbnail: info.thumbnail || '', duration: info.duration || 0, uploader: info.uploader || '',
          webpageUrl: info.webpage_url || url, formats, audioTracks, subtitles, audioFormats, isYoutube,
        }
        // 保存原始 info JSON：下载时用 --load-info-json 跳过 yt-dlp 二次提取
        try {
          result.cacheFile = path.join(os.tmpdir(), `downvid-${info.id || Date.now()}.json`)
          fs.writeFileSync(result.cacheFile, output)
        } catch {}
        parseCache.set(cacheKey, { data: result, time: Date.now(), ver: PARSE_CACHE_VERSION })
        cleanupCache()
        resolve(result)
      } catch (e: any) { reject(new Error('解析响应失败: ' + (e.message || '未知错误'))) }
    })
  })
}

import { dialog, shell } from 'electron'

export async function promptNodeDownload(): Promise<void> {
  const result = await dialog.showMessageBox({
    type: 'info',
    title: '需要 Node.js 运行时',
    message: 'YouTube 视频解析需要 Node.js 运行时',
    detail: '点击"确定"将跳转到 Node.js 下载页面，请下载 Windows Installer (.msi) 版本并安装后重试。',
    buttons: ['确定', '取消'],
    defaultId: 0,
  })
  if (result.response === 0) {
    shell.openExternal('https://nodejs.org/zh-cn/download/package-manager')
  }
}

export async function promptChromeDownload(): Promise<void> {
  const result = await dialog.showMessageBox({
    type: 'info',
    title: '需要 Google Chrome 浏览器',
    message: '抖音/快手视频解析需要 Chrome 浏览器支持',
    detail: '点击"确定"将跳转到 Chrome 下载页面，请下载并安装 Chrome 后重试。',
    buttons: ['确定', '取消'],
    defaultId: 0,
  })
  if (result.response === 0) {
    shell.openExternal('https://www.google.com/chrome/')
  }
}

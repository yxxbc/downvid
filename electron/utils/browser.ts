import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

// promptChromeDownload 延迟导入，避免 circular import（browser.ts ↔ ytdlp.ts）
async function promptChromeDownloadLazy() {
  const { promptChromeDownload } = await import('../parsers/ytdlp')
  return promptChromeDownload()
}

// Puppeteer browser 实例池：复用 Chrome，避免每次解析都冷启动（3-10s）
let sharedBrowser: any = null
let browserLaunchPromise: Promise<any> | null = null
const BROWSER_IDLE_TIMEOUT = 30_000
let browserIdleTimer: ReturnType<typeof setTimeout> | null = null

export async function getSharedBrowser(): Promise<any> {
  if (browserIdleTimer) { clearTimeout(browserIdleTimer); browserIdleTimer = null }

  if (sharedBrowser && sharedBrowser.connected) {
    return sharedBrowser
  }

  if (browserLaunchPromise) {
    return browserLaunchPromise
  }

  const puppeteer = await import('puppeteer-core')
  const chromePath = getChromiumPath()
  if (!chromePath) {
    await promptChromeDownloadLazy()
    throw new Error('未检测到 Chrome 浏览器')
  }

  browserLaunchPromise = puppeteer.default.launch({
    headless: true,
    executablePath: chromePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  }).then((browser: any) => {
    sharedBrowser = browser
    browserLaunchPromise = null
    browser.on('disconnected', () => { sharedBrowser = null })
    return browser
  }).catch((err: any) => {
    browserLaunchPromise = null
    throw err
  })

  return browserLaunchPromise
}

export function scheduleBrowserClose() {
  if (browserIdleTimer) clearTimeout(browserIdleTimer)
  browserIdleTimer = setTimeout(async () => {
    browserIdleTimer = null
    if (sharedBrowser && sharedBrowser.connected) {
      try { await sharedBrowser.close() } catch {}
      sharedBrowser = null
    }
  }, BROWSER_IDLE_TIMEOUT)
}

// 获取 Chromium 路径（跨平台）
export function getChromiumPath(): string | null {
  const platform = process.platform

  if (platform === 'win32') {
    const chromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ]
    for (const p of chromePaths) {
      if (fs.existsSync(p)) return p
    }
    const edgePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]
    for (const p of edgePaths) {
      if (fs.existsSync(p)) return p
    }
  } else if (platform === 'darwin') {
    const chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      path.join(os.homedir(), 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
    ]
    for (const p of chromePaths) {
      if (fs.existsSync(p)) return p
    }
    const edgePaths = [
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ]
    for (const p of edgePaths) {
      if (fs.existsSync(p)) return p
    }
  } else if (platform === 'linux') {
    const chromePaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
    ]
    for (const p of chromePaths) {
      if (fs.existsSync(p)) return p
    }
  }

  return null
}

// 获取可用的浏览器名称（跨平台）
export function getAvailableBrowser(): string {
  const platform = process.platform

  if (platform === 'win32') {
    const chromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ]
    for (const p of chromePaths) {
      if (fs.existsSync(p)) return 'chrome'
    }
    const edgePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ]
    for (const p of edgePaths) {
      if (fs.existsSync(p)) return 'edge'
    }
    const firefoxPaths = [
      path.join(os.homedir(), 'AppData', 'Local', 'Mozilla Firefox', 'firefox.exe'),
      'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
      'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
    ]
    for (const p of firefoxPaths) {
      if (fs.existsSync(p)) return 'firefox'
    }
  } else if (platform === 'darwin') {
    if (fs.existsSync('/Applications/Google Chrome.app')) return 'chrome'
    if (fs.existsSync('/Applications/Microsoft Edge.app')) return 'edge'
    if (fs.existsSync('/Applications/Safari.app')) return 'safari'
    if (fs.existsSync('/Applications/Firefox.app')) return 'firefox'
    if (fs.existsSync('/Applications/Brave Browser.app')) return 'brave'
  } else if (platform === 'linux') {
    const chromePaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ]
    for (const p of chromePaths) {
      if (fs.existsSync(p)) return 'chrome'
    }
    if (fs.existsSync('/usr/bin/firefox')) return 'firefox'
  }

  return ''
}

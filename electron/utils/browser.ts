import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

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
  } else if (platform === 'darwin') {
    if (fs.existsSync('/Applications/Google Chrome.app')) return 'chrome'
    if (fs.existsSync('/Applications/Microsoft Edge.app')) return 'edge'
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
  }

  return ''
}

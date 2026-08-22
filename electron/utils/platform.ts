import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

export function isDouyinUrl(url: string): boolean {
  return url.includes('douyin.com') || url.includes('v.douyin.com')
}

export function isKuaishouUrl(url: string): boolean {
  return url.includes('kuaishou.com') || url.includes('v.kuaishou.com')
}

export function isBilibiliUrl(url: string): boolean {
  return url.includes('bilibili.com') || url.includes('b23.tv')
}

export function getDefaultDownloadDir(): string {
  return path.join(os.homedir(), 'Downloads', 'DownVid')
}

export function ensureDownloadDir(dir: string): string {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

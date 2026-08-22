import path from 'node:path'
import fs from 'node:fs'
import { spawn } from 'node:child_process'

const __dirname = path.dirname(new URL(import.meta.url).pathname)

// 获取 yt-dlp 路径（跨平台）
export function getYtDlpPath(): string {
  const platform = process.platform
  const isWin = platform === 'win32'
  const ytdlpName = isWin ? 'yt-dlp.exe' : 'yt-dlp'

  const possiblePaths = [
    path.join(process.resourcesPath || '', 'bin', ytdlpName),
    path.join(process.env.APP_ROOT || '', 'bin', platform, process.arch, ytdlpName),
    path.join(process.env.APP_ROOT || '', 'bin', ytdlpName),
    path.join(process.env.APP_ROOT || '', ytdlpName),
    path.join(__dirname, '..', '..', 'bin', platform, process.arch, ytdlpName),
    ytdlpName,
  ]

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) return p
    } catch {}
  }

  return ytdlpName
}

// 获取 ffmpeg 路径（跨平台）
export function getFfmpegPath(): string {
  const platform = process.platform
  const isWin = platform === 'win32'
  const ffmpegName = isWin ? 'ffmpeg.exe' : 'ffmpeg'

  const possiblePaths = [
    path.join(process.resourcesPath || '', 'bin', ffmpegName),
    path.join(process.env.APP_ROOT || '', 'bin', platform, process.arch, ffmpegName),
    path.join(process.env.APP_ROOT || '', 'bin', ffmpegName),
    path.join(process.env.APP_ROOT || '', ffmpegName),
    path.join(__dirname, '..', '..', 'bin', platform, process.arch, ffmpegName),
    path.join(process.cwd(), ffmpegName),
    ffmpegName,
  ]

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) return p
    } catch {}
  }

  return ffmpegName
}

// 检查 JS 运行时是否可用
export function checkJsRuntime(): { available: boolean; path: string | null; name: string } {
  const platform = process.platform
  const isWin = platform === 'win32'

  const nodeName = isWin ? 'node.exe' : 'node'
  const nodePaths = [
    nodeName,
    isWin ? 'C:\\Program Files\\nodejs\\node.exe' : '/usr/bin/node',
    isWin ? 'C:\\Program Files (x86)\\nodejs\\node.exe' : '/usr/local/bin/node',
    isWin ? 'D:\\NodeJs\\node.exe' : '',
    isWin ? 'E:\\NodeJs\\node.exe' : '',
  ]

  for (const p of nodePaths) {
    try {
      if (fs.existsSync(p)) return { available: true, path: p, name: 'Node.js' }
    } catch {}
  }

  const denoName = isWin ? 'deno.exe' : 'deno'
  const denoPaths = [
    denoName,
    path.join(process.env.APP_ROOT || '', denoName),
    path.join(process.resourcesPath || '', denoName),
    path.join(__dirname, '..', '..', denoName),
    path.join(process.cwd(), denoName),
  ]

  for (const p of denoPaths) {
    try {
      if (fs.existsSync(p)) return { available: true, path: p, name: 'Deno' }
    } catch {}
  }

  return { available: false, path: null, name: '' }
}

// 检查 ffmpeg 是否可用
export async function checkFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn(getFfmpegPath(), ['-version'])
    ffmpeg.on('error', () => resolve(false))
    ffmpeg.on('close', (code) => resolve(code === 0))
  })
}

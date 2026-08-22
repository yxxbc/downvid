import { ipcMain, BrowserWindow } from 'electron'
import { spawn, exec } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { getYtDlpPath, getFfmpegPath, checkJsRuntime } from '../utils/binary'
import { getAvailableBrowser } from '../utils/browser'
import { isDouyinUrl, isKuaishouUrl, ensureDownloadDir } from '../utils/platform'
import { parseDouyinWithAPI, parseDouyinWithPuppeteer } from '../parsers/douyin'
import { parseKuaishouWithAPI, parseKuaishouWithPuppeteer } from '../parsers/kuaishou'
import { parseWithYtdlp, promptNodeDownload } from '../parsers/ytdlp'
import { activeDownloads } from '../store'

function sendDownloadProgress(data: any) {
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) win.webContents.send('download:progress', data)
  })
}

async function downloadDirectFile(url: string, outputPath: string, taskId: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.douyin.com/',
        },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)

      const totalSize = parseInt(response.headers.get('content-length') || '0')
      const writer = fs.createWriteStream(outputPath)
      let downloaded = 0
      let lastProgressUpdate = 0
      const reader = response.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      sendDownloadProgress({ taskId, url, percent: 0, status: 'downloading', speed: '0 MB/s', eta: '计算中...' })
      const startTime = Date.now()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        writer.write(Buffer.from(value))
        downloaded += value.length

        const now = Date.now()
        if (totalSize > 0 && (downloaded - lastProgressUpdate > 102400 || now - startTime > 500)) {
          lastProgressUpdate = downloaded
          const percent = (downloaded / totalSize) * 100
          const elapsed = (now - startTime) / 1000
          const speed = elapsed > 0 ? (downloaded / 1024 / 1024 / elapsed).toFixed(2) : '0'
          const remaining = downloaded > 0 ? (totalSize - downloaded) / (downloaded / elapsed) : 0
          sendDownloadProgress({
            taskId, url, percent, status: 'downloading',
            totalSize: `${(totalSize / 1024 / 1024).toFixed(1)} MB`,
            speed: `${speed} MB/s`,
            eta: `${Math.ceil(remaining)}s`,
          })
        }
      }

      writer.end()
      await new Promise((resolveWriter, rejectWriter) => {
        writer.on('finish', () => { sendDownloadProgress({ taskId, url, percent: 100, status: 'completed' }); resolveWriter(undefined) })
        writer.on('error', rejectWriter)
      })
      resolve()
    } catch (e) { reject(e) }
  })
}

export function registerDownloadIpc() {
  ipcMain.handle('ytdlp:parse', async (_event, ...args) => {
    const url = args[0] as string
    const cookiesFile = args[1] as string | undefined

    if (isDouyinUrl(url)) {
      try { return await parseDouyinWithAPI(url) } catch {
        try { return await parseDouyinWithPuppeteer(url) } catch {}
      }
    }
    if (isKuaishouUrl(url)) {
      try { return await parseKuaishouWithAPI(url) } catch {
        try { return await parseKuaishouWithPuppeteer(url) } catch {}
      }
    }

    return parseWithYtdlp(url, cookiesFile)
  })

  ipcMain.handle('ytdlp:download', async (_event, options: {
    url: string; formatId: string; outputDir: string; filename?: string; taskId: string
    directUrl?: string; cookiesFile?: string; downloadMode?: 'video' | 'audio' | 'subtitle'
    audioTrack?: any; subtitles?: string[]; filenameTemplate?: string
  }) => {
    return new Promise(async (resolve, reject) => {
      const outputDir = ensureDownloadDir(options.outputDir)

      if (options.directUrl) {
        const filename = options.filename || `video_${Date.now()}.mp4`
        const outputPath = path.join(outputDir, filename)
        try {
          await downloadDirectFile(options.directUrl, outputPath, options.taskId)
          resolve({ filePath: outputPath })
          return
        } catch {}
      }

      const ytdlpPath = getYtDlpPath()
      const isYoutube = options.url.includes('youtube.com') || options.url.includes('youtu.be')
      const isBilibili = options.url.includes('bilibili.com') || options.url.includes('b23.tv')

      const userTemplate = options.filenameTemplate || '%(title)s'
      const outputTemplate = path.join(outputDir, `${userTemplate}.%(ext)s`)

      const isAudioOnly = options.downloadMode === 'audio'
      const isSubtitleOnly = options.downloadMode === 'subtitle'

      let formatSelector: string
      if (isSubtitleOnly) {
        formatSelector = 'best'
      } else if (isAudioOnly) {
        formatSelector = options.formatId
      } else {
        if (options.audioTrack?.isM3u8) {
          formatSelector = options.audioTrack.formatId
        } else if (options.audioTrack?.language) {
          formatSelector = `${options.formatId}+bestaudio[language^=${options.audioTrack.language}]/bestaudio/best`
        } else {
          formatSelector = `${options.formatId}+bestaudio[ext=m4a]/bestaudio/best`
        }
      }

      const args: string[] = ['-o', outputTemplate, '--newline', '--no-playlist', '--encoding', 'utf-8']
      if (!isSubtitleOnly) args.unshift('-f', formatSelector)

      if (isSubtitleOnly) {
        args.push('--skip-download', '--write-subs', '--sub-langs', options.subtitles?.join(',') || 'all', '--convert-subs', 'srt')
      } else if (isAudioOnly) {
        args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0')
      } else {
        args.push('--merge-output-format', 'mp4')
      }

      args.push('--ffmpeg-location', getFfmpegPath())
      if (isAudioOnly) args.push('--postprocessor-args', 'FFmpegMetadata:-write_id3v1 1')
      if (!isSubtitleOnly && options.subtitles?.length) {
        args.push('--write-subs', '--sub-langs', options.subtitles.join(','), '--convert-subs', 'srt')
      }

      if (isYoutube) {
        const runtimeCheck = checkJsRuntime()
        if (!runtimeCheck.available) { await promptNodeDownload(); reject(new Error('需要安装 Node.js')); return }
        const runtimePath = runtimeCheck.path
        if (runtimePath) {
          const isNode = runtimePath.includes('node')
          args.push('--js-runtimes', `${isNode ? 'node' : 'deno'}:${runtimePath}`)
        }
        if (options.cookiesFile && fs.existsSync(options.cookiesFile)) {
          args.push('--cookies', options.cookiesFile)
        } else {
          const browser = getAvailableBrowser()
          if (browser) args.push('--cookies-from-browser', browser)
        }
      }

      if (isBilibili) {
        if (options.cookiesFile && fs.existsSync(options.cookiesFile)) {
          args.push('--cookies', options.cookiesFile)
        } else {
          const browser = getAvailableBrowser()
          if (browser) args.push('--cookies-from-browser', browser)
        }
      }

      args.push(options.url)

      const cwd = path.dirname(ytdlpPath)
      const child = spawn(ytdlpPath, args, { cwd })
      let downloadedFile = ''
      let lastProgress = 0
      let hasStarted = false
      let isPaused = false
      let errorOutput = ''

      activeDownloads.set(options.taskId, { child, options, status: 'downloading', setPaused: (v: boolean) => { isPaused = v } })

      sendDownloadProgress({ taskId: options.taskId, url: options.url, percent: 0, status: 'downloading', speed: '0 MiB/s', eta: '00:00' })

      child.stdout.on('data', (data) => {
        const line = data.toString()
        const progressPatterns = [
          /\[download\]\s+(\d+\.?\d*)%\s+of\s+~?\s*(\d+\.?\d*\w?)\s+at\s+([\d.]+\w?\/s)\s+ETA\s+(\d+:\d+)/,
          /\[download\]\s+(\d+\.?\d*)%\s+of\s+(\d+\.?\d*\w?)\s+at\s+([\d.]+\w?\/s)\s+ETA\s+(\d+:\d+)/,
          /\[download\]\s+(\d+\.?\d*)%/,
        ]
        for (const pattern of progressPatterns) {
          const match = line.match(pattern)
          if (match) {
            const percent = parseFloat(match[1])
            if (Math.abs(percent - lastProgress) > 0.1 || !hasStarted) {
              lastProgress = percent
              hasStarted = true
              sendDownloadProgress({
                taskId: options.taskId, url: options.url, percent,
                totalSize: match[2] || '', speed: match[3] || '', eta: match[4] || '', status: 'downloading',
              })
            }
            break
          }
        }

        const destMatch = line.match(/\[download\] Destination: (.+)/)
        if (destMatch) downloadedFile = path.resolve(destMatch[1].trim().replace(/\//g, '\\'))

        const existsMatch = line.match(/\[download\] (.+) has already been downloaded/)
        if (existsMatch) downloadedFile = path.resolve(existsMatch[1].trim().replace(/\//g, '\\'))

        if (line.includes('[Merger]') || line.includes('Merging formats')) {
          sendDownloadProgress({ taskId: options.taskId, url: options.url, percent: 99, status: 'merging', message: '正在合并音视频...' })
        }

        const mergeMatch = line.match(/\[Merger\] Merging formats into "(.+)"/)
        if (mergeMatch) downloadedFile = path.resolve(mergeMatch[1].trim().replace(/\//g, '\\'))
      })

      child.stderr.on('data', (data) => {
        const line = data.toString()
        errorOutput += line
        const percentMatch = line.match(/(\d+\.?\d*)%/)
        if (percentMatch) {
          const percent = parseFloat(percentMatch[1])
          if (percent > lastProgress || !hasStarted) {
            lastProgress = percent
            hasStarted = true
            sendDownloadProgress({ taskId: options.taskId, url: options.url, percent, status: 'downloading' })
          }
        }
      })

      child.on('close', (code) => {
        activeDownloads.delete(options.taskId)
        if (isPaused) { resolve({ filePath: downloadedFile, paused: true }); return }

        if (code !== 0) {
          const errorLines = errorOutput.split('\n').filter((l: string) => l.trim())
          const lastError = errorLines.length > 0 ? errorLines[errorLines.length - 1].trim() : ''
          if (lastError.includes('429') || lastError.includes('Too Many Requests')) {
            reject(new Error('YouTube 请求过于频繁，请等待几分钟后重试 (HTTP 429)'))
          } else {
            reject(new Error(lastError || '下载失败'))
          }
          return
        }

        if (isSubtitleOnly && !downloadedFile) {
          const firstLang = options.subtitles?.[0] || 'en'
          const basePath = outputTemplate.replace(/\.%(ext)s/, '')
          const srtPath = `${basePath}.${firstLang}.srt`
          const vttPath = `${basePath}.${firstLang}.vtt`
          downloadedFile = fs.existsSync(srtPath) ? srtPath : fs.existsSync(vttPath) ? vttPath : srtPath
        }

        if (downloadedFile?.endsWith('.m4a')) downloadedFile = downloadedFile.replace(/\.m4a$/, '.mp4')

        // 清理临时文件
        if (downloadedFile) {
          const basePath = downloadedFile.replace(/\.[^.]+$/, '')
          for (const pattern of [`${basePath}.part`, `${basePath}.ytdl`, `${basePath}.f*.part`, `${basePath}.f*.ytdl`]) {
            try {
              if (pattern.includes('*')) {
                const dir = path.dirname(pattern)
                const baseName = path.basename(pattern).replace(/\*/g, '.*')
                const regex = new RegExp(baseName.replace(/\./g, '\\.'))
                if (fs.existsSync(dir)) {
                  for (const file of fs.readdirSync(dir)) {
                    if (regex.test(file)) fs.unlinkSync(path.join(dir, file))
                  }
                }
              } else if (fs.existsSync(pattern)) {
                fs.unlinkSync(pattern)
              }
            } catch {}
          }
        }

        sendDownloadProgress({ taskId: options.taskId, url: options.url, percent: 100, status: 'completed' })
        resolve({ success: true, filePath: downloadedFile })
      })

      child.on('error', reject)
    })
  })

  ipcMain.handle('ytdlp:pauseDownload', async (_, taskId: string) => {
    const download = activeDownloads.get(taskId)
    if (download?.child) {
      if (download.setPaused) download.setPaused(true)
      download.child.kill()
      if (process.platform === 'win32' && download.child.pid) {
        exec(`taskkill /pid ${download.child.pid} /T /F`, () => {})
      }
      return true
    }
    return false
  })
}

import { dialog, shell } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { getYtDlpPath, checkJsRuntime } from '../utils/binary'
import { getAvailableBrowser } from '../utils/browser'
import { LANG_NAMES } from '../constants'

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

export function parseWithYtdlp(url: string, cookiesFile?: string): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const ytdlpPath = getYtDlpPath()
    const isYoutube = url.includes('youtube.com') || url.includes('youtu.be')
    const isBilibili = url.includes('bilibili.com') || url.includes('b23.tv')

    const args: string[] = [
      '--no-playlist',
      '--no-check-certificates',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    ]

    if (isYoutube) {
      args.unshift('--print', '%()j')
    } else {
      args.unshift('--dump-json')
    }

    if (isYoutube) {
      const runtimeCheck = checkJsRuntime()
      if (!runtimeCheck.available) {
        await promptNodeDownload()
        reject(new Error('需要安装 Node.js 运行时才能解析 YouTube 视频'))
        return
      }
      const runtimePath = runtimeCheck.path
      if (runtimePath) {
        const isNode = runtimePath.includes('node')
        args.push('--js-runtimes', `${isNode ? 'node' : 'deno'}:${runtimePath}`)
      }
      if (cookiesFile && fs.existsSync(cookiesFile)) {
        args.push('--cookies', cookiesFile)
      } else {
        const browser = getAvailableBrowser()
        if (browser) args.push('--cookies-from-browser', browser)
      }
    }

    if (isBilibili) {
      if (cookiesFile && fs.existsSync(cookiesFile)) {
        args.push('--cookies', cookiesFile)
      } else {
        const browser = getAvailableBrowser()
        if (browser) args.push('--cookies-from-browser', browser)
      }
    }

    args.push(url)

    const cwd = path.dirname(ytdlpPath)
    const child = spawn(ytdlpPath, args, { cwd })
    let output = ''
    let errorOutput = ''

    child.stdout?.on('data', (data: Buffer) => { output += data.toString() })
    child.stderr?.on('data', (data: Buffer) => { errorOutput += data.toString() })

    child.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(errorOutput || '解析失败'))
        return
      }

      try {
        const info = JSON.parse(output)

        let formats = (info.formats || [])
          .filter((f: any) => {
            const hasVideo = f.vcodec !== 'none' && f.vcodec !== null && f.vcodec !== undefined && f.vcodec !== ''
            const isVideoFormat = f.height && f.height > 0
            const isM3u8 = f.protocol && f.protocol.includes('m3u8')
            return hasVideo && isVideoFormat && !isM3u8
          })
          .map((f: any) => {
            let filesize = f.filesize || f.filesize_approx || 0
            if (!filesize && f.tbr && info.duration) {
              filesize = Math.floor((f.tbr * 1000 * info.duration) / 8)
            }
            return {
              formatId: f.format_id || '',
              quality: f.quality_label || f.resolution || f.format_note || `${f.height}p`,
              ext: f.ext || f.video_ext || 'mp4',
              filesize,
              width: f.width || 0,
              height: f.height || 0,
              fps: f.fps || 0,
              hasAudio: f.acodec && f.acodec !== 'none',
            }
          })
          .filter((f: any) => f.quality && f.quality !== 'undefinedp')
          .map((f: any) => ({
            ...f,
            _tbr: info.formats ? info.formats.find((orig: any) => orig.format_id === f.formatId)?.tbr || 0 : 0,
            _vbr: info.formats ? info.formats.find((orig: any) => orig.format_id === f.formatId)?.vbr || 0 : 0,
          }))
          .sort((a: any, b: any) => {
            const heightDiff = (b.height || 0) - (a.height || 0)
            if (heightDiff !== 0) return heightDiff
            if (a.hasAudio && !b.hasAudio) return -1
            if (!a.hasAudio && b.hasAudio) return 1
            return (b._tbr || b._vbr || 0) - (a._tbr || a._vbr || 0)
          })
          .filter((f: any, index: number, self: any[]) => {
            const firstIndex = self.findIndex((t: any) => t.quality === f.quality)
            if (index === firstIndex) return true
            const existing = self[firstIndex]
            const fBitrate = f._tbr || f._vbr || 0
            const eBitrate = existing._tbr || existing._vbr || 0
            if (fBitrate > eBitrate) {
              self[firstIndex] = { ...existing, _remove: true }
              return true
            }
            return false
          })
          .filter((f: any) => !f._remove)
          .map((f: any) => {
            const { _tbr, _vbr, _remove, ...rest } = f
            return rest
          }) || []

        // YouTube 多音轨
        const audioTracks: any[] = []
        if (isYoutube && info.formats) {
          const m3u8BestFormat: Record<string, { formatId: string; lang: string; height: number }> = {}
          const m3u8Formats = info.formats.filter((f: any) => f.protocol?.includes('m3u8') && f.language)
          for (const f of m3u8Formats) {
            const lang = f.language
            if (!lang) continue
            const height = f.height || 0
            if (!m3u8BestFormat[lang] || height > m3u8BestFormat[lang].height) {
              m3u8BestFormat[lang] = { formatId: f.format_id, lang, height }
            }
          }

          if (Object.keys(m3u8BestFormat).length > 1) {
            for (const [lang, best] of Object.entries(m3u8BestFormat)) {
              audioTracks.push({
                id: lang,
                name: LANG_NAMES[lang] || lang.toUpperCase(),
                language: lang,
                formatId: best.formatId,
                isM3u8: true,
              })
            }
          } else {
            const langBestFormat: Record<string, { formatId: string; lang: string; abr: number }> = {}
            const audioFormats = info.formats.filter((f: any) => f.vcodec === 'none' && f.acodec && f.acodec !== 'none')
            for (const f of audioFormats) {
              const lang = f.language
              if (!lang) continue
              if (!langBestFormat[lang] || (f.abr || 0) > langBestFormat[lang].abr) {
                langBestFormat[lang] = { formatId: f.format_id, lang, abr: f.abr || 0 }
              }
            }
            for (const [lang, best] of Object.entries(langBestFormat)) {
              audioTracks.push({
                id: lang,
                name: LANG_NAMES[lang] || lang.toUpperCase(),
                language: lang,
                formatId: best.formatId,
              })
            }
          }

          if (info.audio_tracks && Array.isArray(info.audio_tracks)) {
            for (const at of info.audio_tracks) {
              const existing = audioTracks.find(t => t.language === at.language)
              if (existing && at.name) existing.name = at.name
            }
          }
        }

        // 字幕
        const subtitles = info.subtitles || {}
        const subtitleList = Object.keys(subtitles).map((lang: string) => {
          const subData = subtitles[lang]
          const firstSub = Array.isArray(subData) ? subData[0] : subData
          return { language: lang || '', name: firstSub?.name || lang || '', url: firstSub?.url || '' }
        })

        // 纯音频格式
        const audioFormats = isYoutube && info.formats ? info.formats
          .filter((f: any) => f.vcodec === 'none' && f.acodec && f.acodec !== 'none')
          .map((f: any) => ({
            formatId: f.format_id || '',
            quality: f.abr ? `${f.abr}kbps` : (f.format_note || '音频'),
            ext: f.ext || f.audio_ext || 'm4a',
            filesize: f.filesize || f.filesize_approx || 0,
            abr: f.abr || 0,
            acodec: f.acodec || '',
          }))
          .filter((f: any, index: number, self: any[]) => self.findIndex((t: any) => t.abr === f.abr) === index)
          .sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0))
          .slice(0, 6)
        : []

        resolve({
          id: info.id || '',
          title: info.title || '未知标题',
          description: info.description || '',
          thumbnail: info.thumbnail || '',
          duration: info.duration || 0,
          uploader: info.uploader || '',
          webpageUrl: info.webpage_url || url,
          formats,
          audioTracks,
          subtitles: subtitleList,
          audioFormats,
          isYoutube,
        })
      } catch (e: any) {
        reject(new Error('解析响应失败: ' + (e.message || '未知错误')))
      }
    })
  })
}

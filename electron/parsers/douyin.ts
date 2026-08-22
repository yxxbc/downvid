import { getChromiumPath } from '../utils/browser'
import { promptChromeDownload } from './ytdlp'
import fs from 'node:fs'

// 解析 Netscape 格式的 cookies.txt
interface CookieItem {
  domain: string
  includeSubdomains: boolean
  path: string
  secure: boolean
  expiry: number
  name: string
  value: string
}

function parseCookiesFile(filePath: string): CookieItem[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const cookies: CookieItem[] = []
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const parts = trimmed.split('\t')
      if (parts.length < 7) continue
      cookies.push({
        domain: parts[0],
        includeSubdomains: parts[1] === 'TRUE',
        path: parts[2],
        secure: parts[3] === 'TRUE',
        expiry: parseInt(parts[4]) || 0,
        name: parts[5],
        value: parts[6],
      })
    }
    return cookies
  } catch {
    return []
  }
}

// 从 cookies 构建 Cookie 请求头字符串（过滤抖音相关域名）
function buildCookieHeader(cookies: CookieItem[]): string {
  return cookies
    .filter(c => c.domain.includes('douyin.com') || c.domain.includes('iesdouyin.com') || c.domain.includes('snssdk.com'))
    .map(c => `${c.name}=${c.value}`)
    .join('; ')
}

// 估算文件大小
function estimateFileSize(height: number, durationMs: number): number {
  const durationSec = durationMs / 1000
  let bitrate = 2000000
  if (height >= 1080) bitrate = 5000000
  else if (height >= 720) bitrate = 2500000
  else if (height >= 480) bitrate = 1500000
  else if (height >= 360) bitrate = 800000
  return Math.floor((bitrate * durationSec) / 8)
}

// 从 bit_rate 构建格式列表
function buildFormatsFromBitRate(bitRate: any[], duration: number): any[] {
  const qualityMap = new Map<string, any>()

  if (bitRate && bitRate.length > 0) {
    bitRate.forEach((br: any, index: number) => {
      if (br.play_addr?.url_list[0]) {
        let quality = '默认'
        let qualityKey = 'default'
        let height = br.height || 0

        if (br.gear_name) {
          const match = br.gear_name.match(/(\d+)/)
          if (match) {
            quality = `${match[1]}p`
            qualityKey = match[1]
            height = parseInt(match[1])
          } else {
            quality = br.gear_name
            qualityKey = br.gear_name
          }
        } else if (br.height) {
          quality = `${br.height}p`
          qualityKey = String(br.height)
        }

        let filesize = br.data_size || 0
        if (!filesize && duration) {
          filesize = estimateFileSize(height, duration)
        }

        const existing = qualityMap.get(qualityKey)
        if (!existing || filesize > existing.filesize) {
          qualityMap.set(qualityKey, {
            formatId: `hd_${index}`,
            quality,
            ext: 'mp4',
            filesize,
            width: br.width || 0,
            height,
            fps: br.fps || 30,
            hasAudio: true,
            url: br.play_addr.url_list[0],
          })
        }
      }
    })
  }

  return Array.from(qualityMap.values())
    .filter(f => f.url)
    .sort((a, b) => (b.height || 0) - (a.height || 0))
}

// 使用直接 API 调用快速解析抖音视频
export async function parseDouyinWithAPI(url: string, cookiesFile?: string): Promise<any> {
  let videoId: string | null = null

  // 解析 cookies
  const cookies = cookiesFile && fs.existsSync(cookiesFile) ? parseCookiesFile(cookiesFile) : []
  const cookieHeader = buildCookieHeader(cookies)

  const videoMatch = url.match(/\/video\/(\d+)/)
  if (videoMatch) {
    videoId = videoMatch[1]
  }

  if (!videoId) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
        },
      })
      const redirectedUrl = response.url
      const newVideoMatch = redirectedUrl.match(/\/video\/(\d+)/)
      if (newVideoMatch) videoId = newVideoMatch[1]
    } catch {}
  }

  if (!videoId) throw new Error('无法从 URL 提取视频 ID')

  const apiUrl = `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${videoId}&aid=6383&channel=channel_pc_web&detail_list=1`
  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.douyin.com/',
      'Accept': 'application/json',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
    },
  })

  const data = await response.json()
  if (!data.aweme_detail) throw new Error('API 解析失败')

  const detail = data.aweme_detail
  const video = detail.video
  let formats = buildFormatsFromBitRate(video.bit_rate, video.duration)

  if (formats.length === 0 && video.play_addr) {
    const playAddr = video.play_addr
    let filesize = playAddr.data_size || 0
    if (!filesize && video.duration) filesize = estimateFileSize(playAddr.height || 720, video.duration)

    formats = [{
      formatId: 'normal',
      quality: '默认',
      ext: 'mp4',
      filesize,
      width: playAddr.width || 0,
      height: playAddr.height || 0,
      fps: 30,
      hasAudio: true,
      url: playAddr.url_list[0],
    }]
  }

  return {
    id: detail.aweme_id,
    title: detail.desc || '抖音视频',
    description: detail.desc,
    thumbnail: detail.video?.cover?.url_list[0] || detail.video?.dynamic_cover?.url_list[0] || '',
    duration: detail.video?.duration ? Math.floor(detail.video.duration / 1000) : 0,
    uploader: detail.author?.nickname || '',
    webpageUrl: url,
    formats,
  }
}

// 使用无头浏览器解析抖音视频
export async function parseDouyinWithPuppeteer(url: string, cookiesFile?: string): Promise<any> {
  const puppeteer = await import('puppeteer-core')
  const chromePath = getChromiumPath()

  if (!chromePath) {
    await promptChromeDownload()
    throw new Error('未检测到 Chrome 浏览器')
  }

  // 解析 cookies 并转换为 Puppeteer 格式
  const cookies = cookiesFile && fs.existsSync(cookiesFile) ? parseCookiesFile(cookiesFile) : []
  const puppeteerCookies = cookies
    .filter(c => c.domain.includes('douyin.com') || c.domain.includes('iesdouyin.com') || c.domain.includes('snssdk.com'))
    .map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      expires: c.expiry > 0 ? c.expiry : -1,
    }))

  const browser = await puppeteer.default.launch({
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
  })

  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.setViewport({ width: 1920, height: 1080 })

    // 设置 cookies（需要先访问域名才能设置）
    if (puppeteerCookies.length > 0) {
      try {
        await page.goto('https://www.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 15000 })
        await page.setCookie(...puppeteerCookies)
      } catch {}
    }

    let videoData: any = null
    let renderData: any = null

    await page.setRequestInterception(true)
    page.on('request', (request: any) => request.continue())

    page.on('response', async (response: any) => {
      const resUrl = response.url()
      if (resUrl.includes('/aweme/v1/web/aweme/detail/') ||
          resUrl.includes('/aweme/v1/aweme/detail/') ||
          resUrl.includes('/aweme/v1/multi/aweme/detail/')) {
        try { videoData = await response.json() } catch {}
      }
    })

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise(resolve => setTimeout(resolve, 3000))

    await page.evaluate(async () => {
      const container = document.querySelector('.video-container') ||
                        document.querySelector('[data-e2e="video-container"]') ||
                        document.querySelector('.short-video') ||
                        document.body
      container?.scrollIntoView({ behavior: 'instant', block: 'center' })
      await new Promise(r => setTimeout(r, 2000))
      const playBtn = document.querySelector('.play-button') ||
                      document.querySelector('[data-e2e="play-button"]') ||
                      document.querySelector('.video-play')
      if (playBtn) { (playBtn as HTMLElement).click(); await new Promise(r => setTimeout(r, 1000)) }
    })

    renderData = await page.evaluate(() => {
      const ssrData = (window as any)._SSR_HYDRATED_DATA
      if (ssrData) return { source: '_SSR_HYDRATED_DATA', data: ssrData }
      const initialState = (window as any).__INITIAL_STATE__
      if (initialState) return { source: '__INITIAL_STATE__', data: initialState }
      for (const script of document.querySelectorAll('script')) {
        const text = script.textContent || ''
        let match = text.match(/window\._SSR_HYDRATED_DATA\s*=\s*({[\s\S]+?});?\s*$/m)
        if (match) { try { return { source: 'script_SSR', data: JSON.parse(match[1]) } } catch {} }
        match = text.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]+?});?\s*$/m)
        if (match) { try { return { source: 'script_INITIAL', data: JSON.parse(match[1]) } } catch {} }
      }
      return null
    })

    const detailData = videoData?.aweme_detail ||
                       renderData?.data?.aweme?.aweme_detail ||
                       renderData?.data?.app?.aweme_detail ||
                       renderData?.data?.aweme_detail

    let videoInfo: any = null

    if (detailData) {
      const detail = detailData
      const video = detail.video
      const formats = buildFormatsFromBitRate(video.bit_rate, video.duration)

      videoInfo = {
        id: detail.aweme_id,
        title: detail.desc || '抖音视频',
        description: detail.desc,
        thumbnail: detail.video?.cover?.url_list[0] || detail.video?.dynamic_cover?.url_list[0] || '',
        duration: detail.video?.duration ? Math.floor(detail.video.duration / 1000) : 0,
        uploader: detail.author?.nickname || '',
        webpageUrl: url,
        formats,
      }
    } else {
      videoInfo = await page.evaluate(() => {
        const videoEl = document.querySelector('video') as HTMLVideoElement
        const titleEl = document.querySelector('[data-e2e="video-desc"]') || document.querySelector('.title') || document.querySelector('h1')
        const authorEl = document.querySelector('[data-e2e="video-author"]') || document.querySelector('[data-e2e="user-name"]')
        let videoSrc = videoEl?.src || videoEl?.querySelector('source')?.src
        return {
          id: Date.now().toString(),
          title: titleEl?.textContent?.trim() || '抖音视频',
          description: titleEl?.textContent?.trim() || '',
          thumbnail: '',
          duration: videoEl?.duration || 0,
          uploader: authorEl?.textContent?.trim() || '',
          webpageUrl: window.location.href,
          formats: videoSrc ? [{ formatId: 'default', quality: '默认', ext: 'mp4', filesize: 0, width: 0, height: 0, fps: 30, hasAudio: true, url: videoSrc }] : [],
        }
      })
    }

    if (!videoInfo || videoInfo.formats.length === 0) {
      throw new Error('无法获取视频信息，请检查链接是否有效')
    }

    return videoInfo
  } finally {
    await browser.close()
  }
}

<template>
  <div class="flex-1 flex overflow-hidden">
    <!-- Left Panel -->
    <section class="w-[65%] flex flex-col bg-surface relative">
      <div class="flex-1 overflow-y-auto px-8 py-6">
        <div class="max-w-xl mx-auto w-full flex flex-col gap-6">
          <div class="flex flex-col gap-1">
            <h1 class="font-headline text-2xl font-bold leading-tight text-on-surface">全平台视频下载</h1>
            <p class="text-on-surface-variant text-sm">输入链接即刻解析高清数字资产</p>
          </div>

          <UrlInput @parse="parseVideo" />

          <FormatSelector
            v-if="store.videoInfo"
            :video-info="store.videoInfo"
            :selected-format="store.selectedFormat"
            :selected-audio-format="store.selectedAudioFormat"
            :selected-audio-track="store.selectedAudioTrack"
            :selected-subtitles="store.selectedSubtitles"
            :download-mode="store.downloadMode"
            :is-downloading="store.isDownloading"
            @select-video="store.selectVideoFormat"
            @select-audio="store.selectAudioFormat"
            @select-track="store.selectAudioTrack"
            @select-subtitle="store.selectSubtitle"
            @download="store.startDownload"
          />
        </div>
      </div>

      <!-- Progress Bar -->
      <div
        v-if="store.isParsing"
        class="sticky bottom-0 left-0 w-full bg-surface-container-low/95 backdrop-blur-md border-t border-outline-variant/15 px-8 py-3.5 z-20 shadow-sticky-up"
      >
        <div class="max-w-xl mx-auto flex flex-col gap-2">
          <div class="flex justify-between items-center text-[12px] font-semibold">
            <div class="flex items-center gap-2 text-primary">
              <MaterialIcon name="sync" :size="16" class="animate-spin" />
              <span class="tracking-wide">正在提取视频元数据...</span>
            </div>
            <span class="font-mono text-primary font-bold">{{ store.parseProgress }}%</span>
          </div>
          <div class="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div
              class="h-full bg-[#FFB347] rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(255,179,71,0.4)]"
              :style="{ width: store.parseProgress + '%' }"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Right Panel -->
    <DownloadQueue />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import MaterialIcon from './icons/MaterialIcon.vue'
import UrlInput from './UrlInput.vue'
import FormatSelector from './FormatSelector.vue'
import DownloadQueue from './DownloadQueue.vue'
import { useDownloadStore } from '../stores/download'

const store = useDownloadStore()

function extractUrl(text: string): string {
  const cleanText = text.replace(/锟斤拷|锟|斤|拷/g, '').trim()
  const patterns = [
    /https:\/\/v\.douyin\.com\/[a-zA-Z0-9_\-]+/i,
    /https:\/\/www\.xiaohongshu\.com\/discovery\/item\/[a-zA-Z0-9]+[^\s`]*/i,
    /https:\/\/www\.bilibili\.com\/video\/[a-zA-Z0-9]+[^\s`]*/i,
    /https:\/\/b23\.tv\/[a-zA-Z0-9]+/i,
    /https:\/\/(www\.)?(youtube\.com\/watch\?v=[a-zA-Z0-9_-]+|youtu\.be\/[a-zA-Z0-9_-]+)/i,
    /https:\/\/(www\.)?instagram\.com\/[^\s]+/i,
    /https?:\/\/[^\s\u4e00-\u9fa5]+/i,
  ]
  for (const p of patterns) {
    const match = cleanText.match(p)
    if (match) {
      if (p.source.includes('youtube') && match[1]) return 'https://' + match[1] + match[2]
      return match[0]
    }
  }
  return cleanText
}

function isBilibiliUrl(url: string): boolean {
  return url.includes('bilibili.com') || url.includes('b23.tv')
}

async function fetchBilibiliThumbnail(thumbnailUrl: string) {
  try {
    const base64Image = await window.electronAPI.app.fetchImage(thumbnailUrl, 'https://www.bilibili.com/')
    if (base64Image && store.videoInfo) {
      store.videoInfo.thumbnail = base64Image
    }
  } catch {}
}

async function parseVideo() {
  if (!store.url || store.isParsing) return

  store.hasParsed = true
  const extractedUrl = extractUrl(store.url)
  if (extractedUrl !== store.url) store.url = extractedUrl

  store.isParsing = true
  store.parseProgress = 0
  store.videoInfo = null
  store.selectedFormat = null

  const progressInterval = setInterval(() => {
    if (store.parseProgress < 90) store.parseProgress += Math.random() * 15
  }, 200)

  try {
    const settings = JSON.parse(localStorage.getItem('settings') || '{}')
    const cookieMode = settings.cookieMode || 'auto'
    const cookiesFile = cookieMode === 'manual' ? (settings.cookiesFile || '') : ''
    const info = await window.electronAPI.ytdlp.parse(store.url, cookiesFile)
    store.videoInfo = info

    if (isBilibiliUrl(store.url) && info.thumbnail) {
      fetchBilibiliThumbnail(info.thumbnail)
    }

    if (info.formats?.length) {
      store.selectedFormat = info.formats[0]
      store.downloadMode = 'video'
    } else if (info.audioFormats?.length) {
      store.selectedAudioFormat = info.audioFormats[0]
      store.downloadMode = 'audio'
    }

    if (info.audioTracks?.length) {
      const defaultTrack = info.audioTracks.find((t: any) => t.name?.toLowerCase().includes('default') || t.language === 'original')
      store.selectedAudioTrack = defaultTrack || info.audioTracks[0]
    } else {
      store.selectedAudioTrack = null
    }

    store.parseProgress = 100
  } catch (e: any) {
    let errorMsg = e.message || '未知错误'
    if (errorMsg.includes('not a valid URL') || errorMsg.includes('Unsupported URL')) errorMsg = '请输入有效的链接'
    else if (errorMsg.includes('not found') || errorMsg.includes('404')) errorMsg = '视频不存在或已被删除'
    else if (errorMsg.includes('private') || errorMsg.includes('登录')) errorMsg = '该视频需要登录才能访问'
    else if (errorMsg.includes('network') || errorMsg.includes('timeout')) errorMsg = '网络连接超时'
    else if (errorMsg.includes('ffmpeg') || errorMsg.includes('FFmpeg')) errorMsg = 'FFmpeg 未找到'
    else if (errorMsg.toLowerCase().includes('yt-dlp') && errorMsg.includes('not found')) errorMsg = 'yt-dlp 未找到'
    else if (!errorMsg || errorMsg === '解析失败') errorMsg = '无法解析该链接'
    alert('解析失败：' + errorMsg)
  } finally {
    clearInterval(progressInterval)
    store.isParsing = false
  }
}

async function loadDownloadDir() {
  const savedSettings = localStorage.getItem('settings')
  if (savedSettings) {
    const settings = JSON.parse(savedSettings)
    if (settings.downloadDir) {
      store.downloadDir = settings.downloadDir
      return
    }
  }
  store.downloadDir = await window.electronAPI.app.getDefaultDownloadDir()
}

onMounted(async () => {
  await loadDownloadDir()
  window.addEventListener('tab-changed', async (e: any) => {
    if (e.detail === 'download') await loadDownloadDir()
  })
})
</script>

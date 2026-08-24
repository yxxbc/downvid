import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { VideoInfo, VideoFormat, DownloadTask, AudioFormat, AudioTrack } from '../types'

export const useDownloadStore = defineStore('download', () => {
  // URL Input
  const url = ref('')
  const isParsing = ref(false)
  const parseProgress = ref(0)
  const hasParsed = ref(false)

  // Video Info
  const videoInfo = ref<VideoInfo | null>(null)
  const selectedFormat = ref<VideoFormat | null>(null)
  const selectedAudioFormat = ref<AudioFormat | null>(null)
  const selectedAudioTrack = ref<AudioTrack | null>(null)
  const selectedSubtitles = ref<string[]>([])
  const downloadMode = ref<'video' | 'audio' | 'subtitle'>('video')
  const isDownloading = ref(false)

  // Download Tasks
  const downloadTasks = ref<DownloadTask[]>([])
  const downloadDir = ref('')
  const pausedTasks = new Set<string>()
  const taskProgressCleanups = new Map<string, () => void>()

  // Computed
  const isYouTubeUrl = computed(() => {
    const s = url.value.trim().toLowerCase()
    return s.includes('youtube.com') || s.includes('youtu.be')
  })

  const showBilibiliCookieHint = computed(() => {
    const s = url.value.trim().toLowerCase()
    return s.includes('bilibili.com') || s.includes('b23.tv')
  })

  const activeTaskCount = computed(() =>
    downloadTasks.value.filter(t =>
      t.status === 'downloading' || t.status === 'pending' || t.status === 'merging' || t.status === 'paused'
    ).length
  )

  // Actions
  function selectVideoFormat(format: VideoFormat) {
    selectedFormat.value = format
    downloadMode.value = 'video'
    selectedAudioFormat.value = null
    selectedSubtitles.value = []
  }

  function selectAudioFormat(format: AudioFormat) {
    selectedAudioFormat.value = format
    downloadMode.value = 'audio'
    selectedFormat.value = null
    selectedAudioTrack.value = null
    selectedSubtitles.value = []
  }

  function selectAudioTrack(track: AudioTrack) {
    selectedAudioTrack.value = track
    selectedAudioFormat.value = null
    selectedSubtitles.value = []
    if (!selectedFormat.value && videoInfo.value?.formats?.length) {
      selectedFormat.value = videoInfo.value.formats[0]
    }
    downloadMode.value = 'video'
  }

  function selectSubtitle(language: string) {
    const idx = selectedSubtitles.value.indexOf(language)
    if (idx > -1) {
      selectedSubtitles.value.splice(idx, 1)
    } else {
      selectedSubtitles.value = [language]
    }
    selectedFormat.value = null
    selectedAudioFormat.value = null
    selectedAudioTrack.value = null
    downloadMode.value = 'subtitle'
  }

  function sanitizeFilename(name: string): string {
    return name.replace(/[<>"/\\|?*]/g, '_').trim()
  }

  function removeTask(taskId: string) {
    downloadTasks.value = downloadTasks.value.filter(t => t.id !== taskId)
  }

  function clearCompletedTasks() {
    downloadTasks.value = downloadTasks.value.filter(t => t.status !== 'completed')
  }

  function pauseTask(taskId: string) {
    const idx = downloadTasks.value.findIndex(t => t.id === taskId)
    if (idx !== -1) {
      downloadTasks.value[idx].status = 'paused'
      downloadTasks.value[idx].speed = undefined
      downloadTasks.value[idx].eta = undefined
      pausedTasks.add(taskId)
      window.electronAPI?.ytdlp?.pauseDownload?.(taskId)
    }
  }

  function resumeTask(task: DownloadTask) {
    const idx = downloadTasks.value.findIndex(t => t.id === task.id)
    if (idx !== -1) {
      downloadTasks.value[idx].status = 'downloading'
      pausedTasks.delete(task.id)
      processDownload(downloadTasks.value[idx])
    }
  }

  async function processDownload(task: DownloadTask) {
    const taskIndex = downloadTasks.value.findIndex(t => t.id === task.id)
    if (taskIndex === -1) return
    if (downloadTasks.value[taskIndex].status === 'downloading' || downloadTasks.value[taskIndex].status === 'merging') return

    downloadTasks.value[taskIndex].status = 'downloading'

    if (taskProgressCleanups.has(task.id)) {
      taskProgressCleanups.get(task.id)!()
      taskProgressCleanups.delete(task.id)
    }

    const cleanup = window.electronAPI.onDownloadProgress((data: any) => {
      if (data.taskId === task.id) {
        if (pausedTasks.has(task.id) && data.status !== 'completed') return
        const idx = downloadTasks.value.findIndex(t => t.id === task.id)
        if (idx !== -1) {
          if (data.status === 'merging') {
            downloadTasks.value[idx].status = 'merging'
            downloadTasks.value[idx].statusMessage = data.message || '正在合并音视频...'
            downloadTasks.value[idx].progress = 99
          } else if (data.status === 'completed') {
            downloadTasks.value[idx].status = 'completed'
            downloadTasks.value[idx].progress = 100
            pausedTasks.delete(task.id)
          } else {
            downloadTasks.value[idx].progress = data.percent || 0
            downloadTasks.value[idx].totalSize = data.totalSize
            downloadTasks.value[idx].speed = data.speed
            downloadTasks.value[idx].eta = data.eta
          }
        }
      }
    })

    taskProgressCleanups.set(task.id, cleanup)

    try {
      const directUrl = task.selectedFormat.url
      const isDouyin = task.url.includes('douyin.com') || task.url.includes('v.douyin.com')
      const isKuaishou = task.url.includes('kuaishou.com') || task.url.includes('v.kuaishou.com')
      const useDirectDownload = isDouyin || isKuaishou

      const settings = JSON.parse(localStorage.getItem('settings') || '{}')
      const cookieMode = settings.cookieMode || 'auto'
      const cookiesFile = cookieMode === 'manual' ? (settings.cookiesFile || '') : ''
      const filenameTemplate = settings.filenameTemplate || '%(title)s'
      const proxy = settings.proxy || ''

      const downloadOptions: any = {
        url: task.url,
        formatId: task.selectedFormat.formatId,
        outputDir: task.outputDir,
        taskId: task.id,
        directUrl: useDirectDownload && directUrl ? directUrl : undefined,
        filename: useDirectDownload && directUrl ? `${sanitizeFilename(task.videoInfo.title).slice(0, 50)}_${task.selectedFormat.quality}.mp4` : undefined,
        cookiesFile,
        filenameTemplate,
        proxy,
      }

      if ((task as any).downloadMode === 'audio') downloadOptions.downloadMode = 'audio'
      if ((task as any).downloadMode === 'subtitle') downloadOptions.downloadMode = 'subtitle'
      if ((task as any).selectedAudioTrack) downloadOptions.audioTrack = { ...(task as any).selectedAudioTrack }
      if ((task as any).selectedSubtitles?.length > 0) downloadOptions.subtitles = (task as any).selectedSubtitles

      const result = await window.electronAPI.ytdlp.download(downloadOptions)

      const finalIdx = downloadTasks.value.findIndex(t => t.id === task.id)
      if (finalIdx !== -1) {
        downloadTasks.value[finalIdx].status = 'completed'
        downloadTasks.value[finalIdx].filePath = (result as any).filePath
        downloadTasks.value[finalIdx].progress = 100
      }

      try {
        await window.electronAPI.history.add({
          title: task.videoInfo.title,
          thumbnail: task.videoInfo.thumbnail,
          url: task.url,
          filePath: (result as any).filePath,
          format: task.selectedFormat.ext,
          quality: task.selectedFormat.quality,
        })
      } catch (historyErr) {
        console.error('Failed to add history record:', historyErr)
      }
    } catch (e: any) {
      let errorMsg = e.message || '下载失败'
      if (errorMsg.includes('disk') || errorMsg.includes('space')) errorMsg = '磁盘空间不足'
      else if (errorMsg.includes('permission') || errorMsg.includes('access')) errorMsg = '没有写入权限'
      else if (errorMsg.includes('network') || errorMsg.includes('timeout') || errorMsg.includes('ECONNRESET')) errorMsg = '网络连接中断'
      else if (errorMsg.includes('ffmpeg') || errorMsg.includes('FFmpeg')) errorMsg = 'FFmpeg 合并失败'

      const errorIdx = downloadTasks.value.findIndex(t => t.id === task.id)
      if (errorIdx !== -1) {
        downloadTasks.value[errorIdx].status = 'error'
        downloadTasks.value[errorIdx].error = errorMsg
      }
    } finally {
      if (taskProgressCleanups.has(task.id)) {
        taskProgressCleanups.get(task.id)!()
        taskProgressCleanups.delete(task.id)
      }
    }
  }

  async function startDownload() {
    if (!videoInfo.value || isDownloading.value) return
    if (downloadMode.value === 'video' && !selectedFormat.value) return
    if (downloadMode.value === 'audio' && !selectedAudioFormat.value) return
    if (downloadMode.value === 'subtitle' && selectedSubtitles.value.length === 0) return

    isDownloading.value = true
    const taskId = Date.now().toString()

    if (downloadMode.value === 'subtitle') {
      const task: DownloadTask = {
        id: taskId,
        url: url.value,
        videoInfo: videoInfo.value,
        selectedFormat: { formatId: 'subtitle', quality: '字幕', ext: 'srt', filesize: 0 },
        outputDir: downloadDir.value,
        status: 'pending',
        progress: 0,
        createdAt: new Date().toISOString(),
      }
      ;(task as any).downloadMode = 'subtitle'
      ;(task as any).selectedSubtitles = [...selectedSubtitles.value]
      downloadTasks.value.unshift(task)
      processDownload(task)
      isDownloading.value = false
      return
    }

    const task: DownloadTask = {
      id: taskId,
      url: url.value,
      videoInfo: videoInfo.value,
      selectedFormat: downloadMode.value === 'audio' && selectedAudioFormat.value
        ? { ...selectedAudioFormat.value, quality: selectedAudioFormat.value.quality, ext: selectedAudioFormat.value.ext }
        : selectedFormat.value!,
      outputDir: downloadDir.value,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
    }
    ;(task as any).downloadMode = downloadMode.value
    ;(task as any).selectedAudioTrack = selectedAudioTrack.value ? { ...selectedAudioTrack.value } : null
    ;(task as any).selectedSubtitles = []
    downloadTasks.value.unshift(task)
    processDownload(task)
    isDownloading.value = false
  }

  return {
    url, isParsing, parseProgress, hasParsed,
    videoInfo, selectedFormat, selectedAudioFormat, selectedAudioTrack,
    selectedSubtitles, downloadMode, isDownloading,
    downloadTasks, downloadDir,
    isYouTubeUrl, showBilibiliCookieHint, activeTaskCount,
    selectVideoFormat, selectAudioFormat, selectAudioTrack, selectSubtitle,
    removeTask, clearCompletedTasks, pauseTask, resumeTask, startDownload,
    sanitizeFilename,
  }
})

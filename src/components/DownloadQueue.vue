<template>
  <section class="w-[45%] bg-surface-container-low flex flex-col pt-6 px-6 pb-6 shadow-ambient z-10 border-l border-outline-variant/10">
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-headline text-base font-bold text-on-surface">任务队列</h2>
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-mono font-bold text-on-secondary-container bg-secondary-container px-1.5 py-0.5 rounded-sm">
          {{ activeTaskCount }} 进行中
        </span>
        <button
          class="p-1.5 text-on-surface-variant hover:text-on-surface rounded-sm hover:bg-surface-container-highest transition-colors"
          @click="store.clearCompletedTasks()"
        >
          <MaterialIcon name="clear_all" :size="18" />
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-3 overflow-y-auto pr-1 pb-4">
      <div v-if="store.downloadTasks.length === 0" class="flex flex-col items-center justify-center py-12 text-on-surface-variant">
        <MaterialIcon name="download_for_offline" :size="48" class="mb-3 opacity-30" />
        <p class="text-sm">暂无下载任务</p>
        <p class="text-xs mt-1 opacity-70">解析视频后点击下载按钮添加任务</p>
      </div>

      <div
        v-for="task in store.downloadTasks"
        :key="task.id"
        class="flex flex-col p-3 rounded-md border transition-all"
        :class="{
          'bg-surface-container-lowest shadow-sm border-outline-variant/10': task.status === 'downloading' || task.status === 'merging',
          'bg-surface-container-lowest border-outline-variant/10 opacity-70': task.status === 'pending',
          'bg-surface-container-highest/60 border-outline-variant/5': task.status === 'completed',
          'bg-error-container/10 border-error/20': task.status === 'error',
          'bg-amber-container/20 border-amber/30': task.status === 'paused'
        }"
      >
        <div class="flex gap-3">
          <div
            class="w-20 h-14 rounded-sm bg-surface-variant bg-cover bg-center flex-shrink-0 relative overflow-hidden"
            :style="{ backgroundImage: `url(${task.videoInfo.thumbnail})` }"
          >
            <div v-if="task.videoInfo.duration" class="absolute bottom-1 right-1 bg-inverse-surface/80 text-inverse-on-surface text-[8px] font-mono px-0.5 rounded-sm">
              {{ formatDuration(task.videoInfo.duration) }}
            </div>
            <div v-if="task.status === 'pending'" class="absolute inset-0 bg-surface/40 flex items-center justify-center backdrop-blur-[1px]">
              <MaterialIcon name="hourglass_empty" class="text-on-surface" :size="18" />
            </div>
          </div>

          <div class="flex flex-col flex-1 justify-between min-w-0 py-0.5">
            <div class="flex justify-between items-start gap-2">
              <h4 class="font-headline text-xs font-bold truncate" :class="task.status === 'pending' ? 'text-on-surface opacity-70' : 'text-on-surface'">
                {{ task.videoInfo.title }}
              </h4>
              <button class="text-on-surface-variant hover:text-error transition-colors flex-shrink-0" @click="store.removeTask(task.id)">
                <MaterialIcon name="close" :size="14" />
              </button>
            </div>

            <!-- Downloading/Merging -->
            <template v-if="task.status === 'downloading' || task.status === 'merging'">
              <div class="flex items-center justify-between text-[10px] text-on-surface-variant font-mono">
                <span>
                  <span v-if="task.status === 'merging'" class="text-primary">{{ task.statusMessage || '正在合并音视频...' }}</span>
                  <span v-else-if="task.speed">{{ task.speed }} - ETA {{ task.eta }}</span>
                  <span v-else>正在下载...</span>
                </span>
                <div class="flex items-center gap-2">
                  <button class="text-on-surface-variant hover:text-amber transition-colors" @click="store.pauseTask(task.id)" title="暂停下载">
                    <MaterialIcon name="pause" :size="14" />
                  </button>
                  <span class="font-bold text-primary">{{ Math.round(task.progress || 0) }}%</span>
                </div>
              </div>
              <div class="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden mt-1">
                <div class="h-full bg-primary-fixed rounded-full transition-all duration-300" :class="{ 'animate-pulse': task.status === 'merging' }" :style="{ width: (task.progress || 0) + '%' }" />
              </div>
            </template>

            <!-- Paused -->
            <template v-else-if="task.status === 'paused'">
              <div class="flex items-center justify-between text-[10px] text-on-surface-variant font-mono">
                <span class="text-amber">已暂停</span>
                <div class="flex items-center gap-2">
                  <button class="text-on-surface-variant hover:text-primary transition-colors" @click="store.resumeTask(task)" title="继续下载">
                    <MaterialIcon name="play_arrow" :size="14" />
                  </button>
                  <span class="font-bold text-amber">{{ Math.round(task.progress || 0) }}%</span>
                </div>
              </div>
              <div class="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden mt-1">
                <div class="h-full bg-amber rounded-full transition-all duration-300" :style="{ width: (task.progress || 0) + '%' }" />
              </div>
            </template>

            <!-- Pending -->
            <div v-else-if="task.status === 'pending'" class="flex items-center gap-1.5 text-[10px] text-on-surface-variant mt-1.5">
              <MaterialIcon name="pending" :size="12" />
              <span>等待下载...</span>
            </div>

            <!-- Completed -->
            <div v-else-if="task.status === 'completed'" class="flex items-center justify-between mt-1">
              <span class="text-[10px] text-on-surface-variant font-mono">{{ task.selectedFormat.quality }}</span>
              <button class="p-1 text-on-surface-variant hover:text-primary transition-colors" @click="openFileLocation(task)">
                <MaterialIcon name="folder_open" :size="16" />
              </button>
            </div>

            <!-- Error -->
            <div v-else-if="task.status === 'error'" class="flex items-center gap-1.5 text-[10px] text-error mt-1.5">
              <MaterialIcon name="error" :size="12" />
              <span class="truncate">{{ task.error || '下载失败' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Storage Info -->
    <div class="mt-auto pt-4 border-t border-outline-variant/10 flex items-center justify-between text-[11px] text-on-surface-variant">
      <div class="flex items-center gap-2">
        <MaterialIcon name="storage" :size="14" />
        <span>存储空间: 可用</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="font-mono">{{ store.downloadDir }}</span>
        <button class="p-1 hover:bg-surface-container-highest rounded transition-colors" @click="selectDownloadDir">
          <MaterialIcon name="folder_open" :size="14" />
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MaterialIcon from './icons/MaterialIcon.vue'
import { useDownloadStore } from '../stores/download'
import type { DownloadTask } from '../types'

const store = useDownloadStore()

const activeTaskCount = computed(() => store.activeTaskCount)

function formatDuration(seconds?: number): string {
  if (!seconds) return ''
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

async function openFileLocation(task: DownloadTask) {
  if (task.filePath) {
    await window.electronAPI.shell.openPath(task.filePath)
  }
}

async function selectDownloadDir() {
  const dir = await window.electronAPI.dialog.selectFolder()
  if (dir) {
    store.downloadDir = dir
    const savedSettings = localStorage.getItem('settings')
    const settings = savedSettings ? JSON.parse(savedSettings) : {}
    settings.downloadDir = dir
    localStorage.setItem('settings', JSON.stringify(settings))
  }
}
</script>

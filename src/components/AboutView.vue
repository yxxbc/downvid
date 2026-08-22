<template>
  <div class="flex-1 bg-surface overflow-y-auto">
    <div class="max-w-2xl mx-auto px-6 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="font-headline text-2xl font-bold text-on-surface">关于</h1>
      </div>

      <!-- App Info Card -->
      <div class="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-2xl p-6 mb-6 border border-outline-variant/10">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <svg class="w-9 h-9 text-primary" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.57829 8.57829C5.52816 11.6284 3.451 15.5145 2.60947 19.7452C1.76794 23.9758 2.19984 28.361 3.85056 32.3462C5.50128 36.3314 8.29667 39.7376 11.8832 42.134C15.4698 44.5305 19.6865 45.8096 24 45.8096C28.3135 45.8096 32.5302 44.5305 36.1168 42.134C39.7033 39.7375 42.4987 36.3314 44.1494 32.3462C45.8002 28.361 46.2321 23.9758 45.3905 19.7452C44.549 15.5145 42.4718 11.6284 39.4217 8.57829L24 24L8.57829 8.57829Z" fill="currentColor"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="font-headline text-xl font-bold text-on-surface">DownVid</h2>
            <p class="text-on-surface-variant text-sm mt-0.5">v{{ appVersion }}</p>
          </div>
          <button
            class="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
            @click="showUpdateDrawer = true"
          >
            <MaterialIcon name="update" :size="16" />
            <span>检查更新</span>
          </button>
        </div>
      </div>

      <!-- Description -->
      <div class="bg-surface-container-low rounded-xl p-5 mb-6 border border-outline-variant/10">
        <p class="text-sm text-on-surface-variant leading-relaxed">
          DownVid 是一款开源的视频下载工具，基于 YT-DLP 开发，支持抖音、B站、YouTube 等多个平台的视频下载。
        </p>
      </div>

      <!-- Links -->
      <div class="space-y-3 mb-6">
        <button
          @click="openExternal('https://github.com/yxxbc/downvid')"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low hover:bg-surface-container-highest transition-colors group border border-outline-variant/10 text-left"
        >
          <div class="w-9 h-9 rounded-lg bg-surface-container-highest flex items-center justify-center group-hover:bg-surface transition-colors">
            <MaterialIcon name="code" :size="18" class="text-on-surface" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-on-surface">GitHub</p>
            <p class="text-xs text-on-surface-variant truncate">github.com/yxxbc/downvid</p>
          </div>
          <MaterialIcon name="arrow_forward_ios" :size="14" class="text-on-surface-variant" />
        </button>

        <button
          @click="openExternal('https://github.com/yxxbc/downvid/issues')"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low hover:bg-surface-container-highest transition-colors group border border-outline-variant/10 text-left"
        >
          <div class="w-9 h-9 rounded-lg bg-surface-container-highest flex items-center justify-center group-hover:bg-surface transition-colors">
            <MaterialIcon name="feedback" :size="18" class="text-on-surface" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-on-surface">问题反馈</p>
            <p class="text-xs text-on-surface-variant">提交建议或报告问题</p>
          </div>
          <MaterialIcon name="arrow_forward_ios" :size="14" class="text-on-surface-variant" />
        </button>
      </div>

      <!-- Tech Stack -->
      <div class="mb-6">
        <h3 class="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-3">技术栈</h3>
        <div class="flex flex-wrap gap-2">
          <span class="text-xs px-3 py-1.5 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/10">Electron</span>
          <span class="text-xs px-3 py-1.5 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/10">Vue 3</span>
          <span class="text-xs px-3 py-1.5 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/10">TypeScript</span>
          <span class="text-xs px-3 py-1.5 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/10">YT-DLP</span>
          <span class="text-xs px-3 py-1.5 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/10">FFmpeg</span>
        </div>
      </div>

      <!-- License -->
      <div class="flex items-center justify-between py-4 border-t border-outline-variant/20">
        <div class="flex items-center gap-2">
          <MaterialIcon name="gavel" :size="16" class="text-on-surface-variant" />
          <span class="text-sm text-on-surface-variant">开源协议</span>
        </div>
        <span class="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">MIT License</span>
      </div>

      <!-- Copyright -->
      <div class="text-center pt-4">
        <p class="text-xs text-on-surface-variant/60">© 2026 DownVid</p>
        <p class="text-xs text-on-surface-variant/40 mt-1">Based on <a href="https://github.com/cshuangyy/videdown" class="hover:underline">Videdown</a> by cshuangyy (MIT License)</p>
      </div>
    </div>

    <!-- Update Drawer -->
    <UpdateDrawer :visible="showUpdateDrawer" @close="showUpdateDrawer = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MaterialIcon from './icons/MaterialIcon.vue'
import UpdateDrawer from './UpdateDrawer.vue'

const appVersion = ref('1.0.0')
const showUpdateDrawer = ref(false)

onMounted(async () => {
  try {
    const version = await window.electronAPI?.app?.getVersion?.()
    if (version) appVersion.value = version
  } catch {}
})

async function openExternal(url: string) {
  try {
    await window.electronAPI.shell.openExternal(url)
  } catch {}
}
</script>

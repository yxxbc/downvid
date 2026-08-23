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
          <div class="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            <img src="@/assets/logo.png" alt="DownVid" class="w-full h-full object-contain" />
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

      <!-- Contributors -->
      <div class="mb-6">
        <h3 class="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-3">贡献者</h3>
        <div class="bg-surface-container-low rounded-xl p-5 border border-outline-variant/10">
          <!-- Loading -->
          <div v-if="contributorsLoading" class="flex flex-col items-center justify-center py-8">
            <MaterialIcon name="sync" :size="28" class="text-primary animate-spin mb-2" />
            <p class="text-xs text-on-surface-variant">加载贡献者中...</p>
          </div>

          <!-- Error -->
          <div v-else-if="contributorsError" class="flex flex-col items-center justify-center py-8">
            <MaterialIcon name="error_outline" :size="28" class="text-on-surface-variant mb-2" />
            <p class="text-xs text-on-surface-variant text-center mb-3">{{ contributorsError }}</p>
            <button
              class="text-xs text-primary hover:text-primary/80 underline underline-offset-2"
              @click="loadContributors"
            >
              重试
            </button>
          </div>

          <!-- Success -->
          <div v-else-if="contributors.length > 0" class="flex flex-col gap-3">
            <div class="flex flex-wrap gap-3 justify-center">
              <div
                v-for="c in contributors"
                :key="c.login"
                class="group relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-primary/40 transition-all cursor-pointer"
                :title="`${c.login} · ${c.contributions} 次贡献`"
                @click="openExternal(c.htmlUrl)"
              >
                <img
                  :src="c.avatarUrl"
                  :alt="c.login"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
                <!-- Hover tooltip -->
                <div class="absolute -bottom-9 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-on-surface text-surface text-[11px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {{ c.login }}
                </div>
              </div>
            </div>
            <div v-if="contributorsWarning" class="text-center">
              <span class="text-[11px] text-on-surface-variant/70">{{ contributorsWarning }}</span>
            </div>
            <div class="text-center pt-1">
              <span class="text-xs text-on-surface-variant">共 {{ contributors.length }} 位贡献者</span>
            </div>
          </div>

          <!-- Empty -->
          <div v-else class="flex flex-col items-center justify-center py-8">
            <MaterialIcon name="people_outline" :size="28" class="text-on-surface-variant mb-2" />
            <p class="text-xs text-on-surface-variant">暂无贡献者</p>
          </div>
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

    <!-- Update Modal -->
    <UpdateModal :visible="showUpdateDrawer" @close="showUpdateDrawer = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MaterialIcon from './icons/MaterialIcon.vue'
import UpdateModal from './UpdateModal.vue'

interface Contributor {
  login: string
  avatarUrl: string
  htmlUrl: string
  contributions: number
}

const appVersion = ref('1.0.0')
const showUpdateDrawer = ref(false)

const contributors = ref<Contributor[]>([])
const contributorsLoading = ref(false)
const contributorsError = ref('')
const contributorsWarning = ref('')

async function loadContributors() {
  contributorsLoading.value = true
  contributorsError.value = ''
  contributorsWarning.value = ''
  try {
    const result = await window.electronAPI?.app?.getContributors?.()
    if (result?.success && result.data) {
      contributors.value = result.data
      if (result.warning) contributorsWarning.value = result.warning
    } else {
      contributorsError.value = result?.error || '加载失败'
    }
  } catch (e) {
    contributorsError.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    contributorsLoading.value = false
  }
}

onMounted(async () => {
  try {
    const version = await window.electronAPI?.app?.getVersion?.()
    if (version) appVersion.value = version
  } catch {}

  // 加载贡献者
  loadContributors()
})

async function openExternal(url: string) {
  try {
    await window.electronAPI.shell.openExternal(url)
  } catch {}
}
</script>

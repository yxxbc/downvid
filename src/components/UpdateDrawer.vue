<template>
  <Teleport to="body">
    <!-- Overlay -->
    <Transition name="fade">
      <div
        v-if="visible"
        class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        @click="close"
      />
    </Transition>

    <!-- Drawer -->
    <Transition name="slide">
      <div
        v-if="visible"
        class="fixed right-0 top-0 h-full w-[420px] max-w-[90vw] bg-surface-container-low shadow-2xl z-50 flex flex-col border-l border-outline-variant/10"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MaterialIcon name="system_update" :size="22" class="text-primary" />
            </div>
            <div>
              <h2 class="font-headline text-base font-bold text-on-surface">应用更新</h2>
              <p class="text-xs text-on-surface-variant">当前版本 v{{ currentVersion }}</p>
            </div>
          </div>
          <button
            class="p-2 rounded-lg hover:bg-surface-container-highest transition-colors"
            @click="close"
          >
            <MaterialIcon name="close" :size="20" class="text-on-surface-variant" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto px-6 py-5">
          <!-- Checking -->
          <div v-if="status === 'checking'" class="flex flex-col items-center justify-center py-16">
            <MaterialIcon name="sync" :size="40" class="text-primary animate-spin mb-4" />
            <p class="text-sm text-on-surface-variant">正在检查更新...</p>
          </div>

          <!-- Latest -->
          <div v-else-if="status === 'latest'" class="flex flex-col items-center justify-center py-16">
            <div class="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <MaterialIcon name="check_circle" :size="36" class="text-green-500" />
            </div>
            <p class="text-base font-semibold text-on-surface mb-1">已是最新版本</p>
            <p class="text-sm text-on-surface-variant">DownVid v{{ currentVersion }} 已是最新</p>
          </div>

          <!-- Error -->
          <div v-else-if="status === 'error'" class="flex flex-col items-center justify-center py-16">
            <div class="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-4">
              <MaterialIcon name="error_outline" :size="36" class="text-error" />
            </div>
            <p class="text-base font-semibold text-on-surface mb-1">检查失败</p>
            <p class="text-sm text-on-surface-variant">{{ errorMsg }}</p>
            <button
              class="mt-4 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors"
              @click="checkUpdate"
            >
              重试
            </button>
          </div>

          <!-- Update Available -->
          <div v-else-if="status === 'available'" class="flex flex-col gap-5">
            <!-- Version Info -->
            <div class="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
              <MaterialIcon name="new_releases" :size="24" class="text-primary" />
              <div class="flex-1">
                <p class="text-sm font-semibold text-on-surface">发现新版本 v{{ newVersion }}</p>
                <p class="text-xs text-on-surface-variant mt-0.5">当前版本 v{{ currentVersion }} → v{{ newVersion }}</p>
              </div>
            </div>

            <!-- Release Notes -->
            <div v-if="releaseNotes" class="flex flex-col gap-2">
              <h3 class="text-xs font-bold text-outline uppercase tracking-wider">更新日志</h3>
              <div class="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/10">
                <div class="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{{ releaseNotes }}</div>
              </div>
            </div>

            <!-- Changelog Link -->
            <button
              class="self-start text-xs text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
              @click="openChangelog"
            >
              查看完整更新日志
            </button>
          </div>

          <!-- Downloading -->
          <div v-else-if="status === 'downloading'" class="flex flex-col gap-5">
            <div class="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
              <MaterialIcon name="download" :size="24" class="text-primary" />
              <div class="flex-1">
                <p class="text-sm font-semibold text-on-surface">正在下载 v{{ newVersion }}</p>
                <p class="text-xs text-on-surface-variant mt-0.5">{{ downloadSpeed }}</p>
              </div>
              <span class="text-sm font-bold text-primary font-mono">{{ Math.round(downloadPercent) }}%</span>
            </div>

            <!-- Progress Bar -->
            <div class="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
              <div
                class="h-full bg-primary rounded-full transition-all duration-300"
                :style="{ width: downloadPercent + '%' }"
              />
            </div>
          </div>

          <!-- Downloaded -->
          <div v-else-if="status === 'downloaded'" class="flex flex-col items-center justify-center py-12">
            <div class="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <MaterialIcon name="download_done" :size="36" class="text-green-500" />
            </div>
            <p class="text-base font-semibold text-on-surface mb-1">下载完成</p>
            <p class="text-sm text-on-surface-variant mb-6">重启应用以安装新版本</p>
            <button
              class="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md"
              @click="installUpdate"
            >
              立即重启安装
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div v-if="status === 'available'" class="px-6 py-4 border-t border-outline-variant/10">
          <button
            class="w-full flex items-center justify-center gap-2 rounded-xl h-11 bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md"
            @click="downloadUpdate"
          >
            <MaterialIcon name="download" :size="18" />
            <span>下载并安装</span>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import MaterialIcon from './icons/MaterialIcon.vue'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

type UpdateStatus = 'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'downloaded' | 'error'

const status = ref<UpdateStatus>('idle')
const currentVersion = ref('1.0.0')
const newVersion = ref('')
const releaseNotes = ref('')
const errorMsg = ref('')
const downloadPercent = ref(0)
const downloadSpeed = ref('')

let unsubscribe: (() => void) | null = null

function close() {
  emit('close')
}

async function checkUpdate() {
  status.value = 'checking'
  try {
    const result = await window.electronAPI?.checkForUpdates?.()
    if (result?.error) {
      status.value = 'error'
      errorMsg.value = result.error
    } else if (result?.hasUpdate) {
      status.value = 'available'
      newVersion.value = result.version || ''
      releaseNotes.value = result.releaseNotes || ''
    } else {
      status.value = 'latest'
      currentVersion.value = result?.currentVersion || currentVersion.value
    }
  } catch {
    status.value = 'error'
    errorMsg.value = '检查更新失败，请检查网络连接'
  }
}

async function downloadUpdate() {
  status.value = 'downloading'
  downloadPercent.value = 0
  downloadSpeed.value = '准备下载...'
  try {
    await window.electronAPI?.downloadUpdate?.()
  } catch {
    status.value = 'error'
    errorMsg.value = '下载更新失败'
  }
}

async function installUpdate() {
  await window.electronAPI?.installUpdate?.()
}

function openChangelog() {
  window.electronAPI?.shell?.openExternal?.('https://github.com/yxxbc/downvid/blob/main/CHANGELOG.md')
}

onMounted(async () => {
  try {
    const version = await window.electronAPI?.app?.getVersion?.()
    if (version) currentVersion.value = version
  } catch {}

  // 监听更新状态
  if (window.electronAPI?.onUpdateStatus) {
    unsubscribe = window.electronAPI.onUpdateStatus((data: any) => {
      switch (data.status) {
        case 'checking':
          status.value = 'checking'
          break
        case 'available':
          status.value = 'available'
          newVersion.value = data.version || ''
          releaseNotes.value = data.releaseNotes || ''
          break
        case 'not-available':
          status.value = 'latest'
          break
        case 'downloading':
          status.value = 'downloading'
          downloadPercent.value = data.percent || 0
          if (data.speed) {
            const mbps = (data.speed / 1024 / 1024).toFixed(1)
            downloadSpeed.value = `${mbps} MB/s`
          }
          break
        case 'downloaded':
          status.value = 'downloaded'
          break
        case 'error':
          status.value = 'error'
          errorMsg.value = data.message || '更新失败'
          break
      }
    })
  }
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>

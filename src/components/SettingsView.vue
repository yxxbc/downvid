<template>
  <div class="flex-1 flex flex-col bg-surface p-8 overflow-y-auto">
    <div class="max-w-2xl mx-auto w-full flex flex-col gap-6 pb-8">
      <!-- Header -->
      <div>
        <h1 class="font-headline text-2xl font-bold leading-tight text-on-surface">设置</h1>
        <p class="text-on-surface-variant text-sm mt-1">配置下载偏好和应用程序选项</p>
      </div>
      
      <!-- Settings Sections -->
      <div class="flex flex-col gap-6">
        <!-- Download Settings -->
        <div class="bg-surface-container-low rounded-lg p-6 border border-outline-variant/10">
          <h2 class="font-headline text-base font-bold text-on-surface mb-4 flex items-center gap-2">
            <MaterialIcon name="download" :size="20" class="text-primary" />
            下载设置
          </h2>
          
          <div class="flex flex-col gap-4">
            <!-- Download Path -->
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-on-surface">默认下载目录</label>
              <div class="flex gap-2">
                <input 
                  v-model="settings.downloadDir"
                  type="text"
                  readonly
                  class="flex-1 px-3 py-2 bg-surface-container-highest border border-outline-variant/20 rounded-md text-sm text-on-surface focus:outline-none focus:border-primary/40"
                />
                <button 
                  class="px-4 py-2 bg-surface-container-highest text-on-surface rounded-md text-sm font-medium hover:bg-surface-variant transition-colors border border-outline-variant/20"
                  @click="selectDownloadDir"
                >
                  选择目录
                </button>
              </div>
            </div>
            
            <!-- Filename Template -->
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-on-surface">文件名模板</label>
              <input 
                v-model="settings.filenameTemplate"
                type="text"
                class="px-3 py-2 bg-surface-container-highest border border-outline-variant/20 rounded-md text-sm text-on-surface focus:outline-none focus:border-primary/40"
                placeholder="%(title)s.%(ext)s"
              />
              <p class="text-[11px] text-on-surface-variant">
                可用变量: %(title)s - 标题, %(id)s - 视频ID, %(uploader)s - 上传者
              </p>
            </div>
            
            <!-- Cookies File -->
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-on-surface">设置Cookies 文件</label>
              <div class="flex flex-col gap-3">
                <div class="flex flex-col gap-2">
                  <label class="flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors hover:bg-surface-container-highest">
                    <div 
                      class="size-4 rounded-full border-2 flex items-center justify-center"
                      :class="settings.cookieMode === 'auto' ? 'border-primary' : 'border-outline-variant'"
                    >
                      <div v-if="settings.cookieMode === 'auto'" class="size-2 rounded-full bg-primary" />
                    </div>
                    <input 
                      v-model="settings.cookieMode"
                      type="radio"
                      value="auto"
                      class="hidden"
                    />
                    <div class="flex flex-col">
                      <span class="text-sm text-on-surface font-medium">自动使用默认浏览器 Cookie</span>
                      <span class="text-[11px] text-on-surface-variant">自动从 Chrome/Edge/Safari 等浏览器读取登录状态，无需手动导出</span>
                    </div>
                  </label>

                  <label class="flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors hover:bg-surface-container-highest">
                    <div 
                      class="size-4 rounded-full border-2 flex items-center justify-center"
                      :class="settings.cookieMode === 'manual' ? 'border-primary' : 'border-outline-variant'"
                    >
                      <div v-if="settings.cookieMode === 'manual'" class="size-2 rounded-full bg-primary" />
                    </div>
                    <input 
                      v-model="settings.cookieMode"
                      type="radio"
                      value="manual"
                      class="hidden"
                    />
                    <div class="flex flex-col">
                      <span class="text-sm text-on-surface font-medium">手动导入 Cookie 文件</span>
                      <span class="text-[11px] text-on-surface-variant">使用 Get cookies.txt 等扩展导出 Netscape 格式的 cookies.txt</span>
                    </div>
                  </label>
                </div>

                <div v-if="settings.cookieMode === 'manual'" class="flex gap-2 pl-1">
                  <input 
                    v-model="settings.cookiesFile"
                    type="text"
                    readonly
                    placeholder="选择 cookies.txt 文件"
                    class="flex-1 px-3 py-2 bg-surface-container-highest border border-outline-variant/20 rounded-md text-sm text-on-surface focus:outline-none focus:border-primary/40"
                  />
                  <button 
                    class="px-4 py-2 bg-surface-container-highest text-on-surface rounded-md text-sm font-medium hover:bg-surface-variant transition-colors border border-outline-variant/20"
                    @click="selectCookiesFile"
                  >
                    选择文件
                  </button>
                  <button 
                    v-if="settings.cookiesFile"
                    class="px-4 py-2 bg-error-container text-on-error-container rounded-md text-sm font-medium hover:bg-error transition-colors hover:text-on-error border border-outline-variant/20"
                    @click="clearCookiesFile"
                  >
                    清除
                  </button>
                </div>
              </div>
              <p class="text-[11px] text-on-surface-variant">
                用于抖音、B站、YouTube 等需要登录的平台。自动模式下会尝试从系统默认浏览器读取登录状态
              </p>
            </div>
          </div>
        </div>
        
        <!-- Quality Settings -->
        <div class="bg-surface-container-low rounded-lg p-6 border border-outline-variant/10">
          <h2 class="font-headline text-base font-bold text-on-surface mb-4 flex items-center gap-2">
            <MaterialIcon name="high_quality" :size="20" class="text-primary" />
            画质偏好
          </h2>
          
          <div class="flex flex-col gap-3">
            <label 
              v-for="quality in qualityOptions" 
              :key="quality.value"
              class="flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors hover:bg-surface-container-highest"
            >
              <div 
                class="size-4 rounded-full border-2 flex items-center justify-center"
                :class="settings.preferredQuality === quality.value ? 'border-primary' : 'border-outline-variant'"
              >
                <div v-if="settings.preferredQuality === quality.value" class="size-2 rounded-full bg-primary" />
              </div>
              <input 
                v-model="settings.preferredQuality"
                type="radio"
                :value="quality.value"
                class="hidden"
              />
              <span class="text-sm text-on-surface">{{ quality.label }}</span>
            </label>
          </div>
        </div>

        <!-- App Log -->
        <div class="bg-surface-container-low rounded-lg p-6 border border-outline-variant/10">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-headline text-base font-bold text-on-surface flex items-center gap-2">
              <MaterialIcon name="article" :size="20" class="text-primary" />
              应用日志
            </h2>
            <div class="flex items-center gap-2">
              <button
                class="p-2 rounded-lg hover:bg-surface-container-highest transition-colors"
                title="刷新"
                @click="loadLog"
              >
                <MaterialIcon name="refresh" :size="18" class="text-on-surface-variant" />
              </button>
              <button
                class="p-2 rounded-lg hover:bg-surface-container-highest transition-colors"
                title="复制日志"
                @click="copyLog"
              >
                <MaterialIcon name="content_copy" :size="18" class="text-on-surface-variant" />
              </button>
              <button
                class="p-2 rounded-lg hover:bg-surface-container-highest transition-colors"
                title="打开日志目录"
                @click="openLogDir"
              >
                <MaterialIcon name="folder_open" :size="18" class="text-on-surface-variant" />
              </button>
              <button
                class="p-2 rounded-lg hover:bg-error-container/50 transition-colors"
                title="清空日志"
                @click="clearLog"
              >
                <MaterialIcon name="delete" :size="18" class="text-error" />
              </button>
            </div>
          </div>

          <div class="relative">
            <textarea
              ref="logTextarea"
              v-model="logContent"
              readonly
              class="w-full h-48 p-3 rounded-lg bg-surface-container-highest border border-outline-variant/20 text-xs font-mono text-on-surface-variant resize-none focus:outline-none"
              placeholder="加载日志中..."
            />
            <div v-if="logTotalLines && logTotalLines > 500" class="absolute bottom-2 right-2 text-[10px] text-on-surface-variant/60 bg-surface-container-lowest/80 px-2 py-0.5 rounded">
              仅显示最后 500 行 / 共 {{ logTotalLines }} 行
            </div>
          </div>
        </div>
        
        <!-- Save Button -->
        <button 
          class="w-full flex items-center justify-center gap-2 rounded-xl h-12 font-headline font-bold text-base shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 text-on-primary-fixed gradient-btn-orange"
          @click="saveSettings"
        >
          <MaterialIcon name="save" :size="20" />
          <span>保存设置</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MaterialIcon from './icons/MaterialIcon.vue'

interface Settings {
  downloadDir: string
  filenameTemplate: string
  preferredQuality: string
  cookieMode: 'auto' | 'manual'
  cookiesFile: string
}

const settings = ref<Settings>({
  downloadDir: '',
  filenameTemplate: '%(title)s.%(ext)s',
  preferredQuality: 'best',
  cookieMode: 'auto',
  cookiesFile: '',
})

const ytdlpVersion = ref('检测中...')

const qualityOptions = [
  { value: 'best', label: '最佳画质 (推荐)' },
  { value: '1080p', label: '1080P 高清' },
  { value: '720p', label: '720P 标清' },
  { value: '480p', label: '480P 流畅' },
]

async function selectDownloadDir() {
  const dir = await window.electronAPI.dialog.selectFolder()
  if (dir) {
    settings.value.downloadDir = dir
    // 自动保存设置
    localStorage.setItem('settings', JSON.stringify(settings.value))
  }
}

async function selectCookiesFile() {
  const file = await window.electronAPI.dialog.selectFile()
  if (file) {
    settings.value.cookiesFile = file
    // 自动保存设置
    localStorage.setItem('settings', JSON.stringify(settings.value))
  }
}

function clearCookiesFile() {
  settings.value.cookiesFile = ''
  // 自动保存设置
  localStorage.setItem('settings', JSON.stringify(settings.value))
}

function saveSettings() {
  localStorage.setItem('settings', JSON.stringify(settings.value))
  alert('设置已保存')
}

// ===== 应用日志 =====
const logContent = ref('')
const logTotalLines = ref(0)
const logTextarea = ref<HTMLTextAreaElement | null>(null)

async function loadLog() {
  try {
    const result = await window.electronAPI?.app?.getLog?.()
    if (result?.success) {
      logContent.value = result.content || ''
      logTotalLines.value = result.totalLines || 0
      // 自动滚动到底部
      setTimeout(() => {
        if (logTextarea.value) {
          logTextarea.value.scrollTop = logTextarea.value.scrollHeight
        }
      }, 50)
    } else {
      logContent.value = `加载日志失败: ${result?.error || '未知错误'}`
    }
  } catch (e) {
    logContent.value = `加载日志失败: ${e instanceof Error ? e.message : '未知错误'}`
  }
}

async function copyLog() {
  try {
    await navigator.clipboard.writeText(logContent.value)
    alert('日志已复制到剪贴板')
  } catch {
    alert('复制失败，请手动选择复制')
  }
}

async function clearLog() {
  if (!confirm('确定要清空所有日志吗？此操作不可撤销。')) return
  try {
    const result = await window.electronAPI?.app?.clearLog?.()
    if (result?.success) {
      logContent.value = ''
      logTotalLines.value = 0
      alert('日志已清空')
    } else {
      alert(`清空失败: ${result?.error || '未知错误'}`)
    }
  } catch (e) {
    alert(`清空失败: ${e instanceof Error ? e.message : '未知错误'}`)
  }
}

async function openLogDir() {
  try {
    await window.electronAPI?.app?.openLogDir?.()
  } catch (e) {
    alert(`打开日志目录失败: ${e instanceof Error ? e.message : '未知错误'}`)
  }
}

async function loadSettings() {
  // Load saved settings first
  const saved = localStorage.getItem('settings')
  if (saved) {
    const parsed = JSON.parse(saved)
    settings.value = { ...settings.value, ...parsed }
  }
  
  // If no download dir set, use default
  if (!settings.value.downloadDir) {
    settings.value.downloadDir = await window.electronAPI.app.getDefaultDownloadDir()
  }
  
  // Check YT-DLP version
  try {
    // This would need a new IPC handler to get version
    ytdlpVersion.value = '已安装'
  } catch (e) {
    ytdlpVersion.value = '未知'
  }
}

onMounted(() => {
  loadSettings()
  loadLog()
})
</script>

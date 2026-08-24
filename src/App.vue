<template>
  <div class="relative flex w-full flex-col h-screen bg-surface">
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
    
    <!-- Header -->
    <Header :current-tab="currentTab" @change-tab="changeTab" />
    
    <!-- Main Content -->
    <main class="flex-1 flex overflow-hidden">
      <DownloadView v-show="currentTab === 'download'" />
      <HistoryView v-show="currentTab === 'history'" />
      <AboutView v-show="currentTab === 'about'" />
    </main>

    <!-- Settings Panel (floating) -->
    <SettingsView :visible="showSettings" @update:visible="showSettings = $event" />

    <!-- Global Error Modal -->
    <ErrorModal
      :visible="modalState.visible"
      :type="modalState.type"
      :title="modalState.title"
      :message="modalState.message"
      :detail="modalState.detail"
      @update:visible="modal.close()"
    />

    <!-- Auto Update Modal -->
    <UpdateModal :visible="showUpdate" @close="showUpdate = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import Header from './components/Header.vue'
import DownloadView from './components/DownloadView.vue'
import HistoryView from './components/HistoryView.vue'
import AboutView from './components/AboutView.vue'
import SettingsView from './components/SettingsView.vue'
import ErrorModal from './components/ErrorModal.vue'
import UpdateModal from './components/UpdateModal.vue'
import { useErrorModal } from './composables/useErrorModal'
import type { TabType } from './types'

const modal = useErrorModal()
const modalState = modal.state

const currentTab = ref<TabType>('download')
const showUpdate = ref(false)
const showSettings = ref(false)

function changeTab(tab: TabType) {
  if (tab === 'settings') {
    showSettings.value = true
    return
  }
  currentTab.value = tab
  window.dispatchEvent(new CustomEvent('tab-changed', { detail: tab }))
}

// 监听跳转设置页事件
window.addEventListener('navigate-to-settings', () => {
  showSettings.value = true
})

// 监听菜单点击关于事件
let unsubscribeMenu: (() => void) | null = null
let unsubscribeUpdate: (() => void) | null = null

onMounted(() => {
  // 通知 preload 移除启动加载动画
  window.postMessage({ payload: 'removeLoading' }, '*')

  if (window.electronAPI?.onMenuShowAbout) {
    unsubscribeMenu = window.electronAPI.onMenuShowAbout(() => {
      currentTab.value = 'about'
    })
  }

  // 启动时自动检查更新
  if (window.electronAPI?.onUpdateStatus) {
    unsubscribeUpdate = window.electronAPI.onUpdateStatus((data: any) => {
      if (data.status === 'available') {
        showUpdate.value = true
      }
    })
  }
  // 延迟 3 秒后检查更新，避免影响启动速度
  setTimeout(() => {
    window.electronAPI?.checkForUpdates?.()
  }, 3000)
})

onUnmounted(() => {
  if (unsubscribeMenu) unsubscribeMenu()
  if (unsubscribeUpdate) unsubscribeUpdate()
})
</script>

<style>
/* Material Symbols Outlined */
.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>

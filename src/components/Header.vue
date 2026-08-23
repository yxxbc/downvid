<template>
  <header class="flex items-center justify-between whitespace-nowrap bg-surface-container-low px-6 py-3 select-none">
    <!-- Logo -->
    <div class="flex items-center gap-3 text-on-surface">
      <div class="size-6 rounded-md overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
        <img src="@/assets/logo.png" alt="DownVid" class="w-full h-full object-contain" />
      </div>
      <h2 class="font-headline text-base font-bold leading-tight tracking-tight text-on-surface">DownVid</h2>
    </div>
    
    <!-- Navigation -->
    <div class="flex flex-1 justify-end gap-6">
      <nav class="flex items-center gap-6">
        <div 
          v-for="tab in tabs" 
          :key="tab.key"
          class="relative flex items-center h-full cursor-pointer"
          @click="$emit('change-tab', tab.key)"
        >
          <span 
            class="font-headline text-sm leading-normal transition-colors"
            :class="currentTab === tab.key ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface font-medium'"
          >
            {{ tab.label }}
          </span>
          <div 
            v-if="currentTab === tab.key"
            class="absolute -bottom-3 left-0 w-full h-0.5 bg-primary rounded-t-full"
          />
        </div>
      </nav>
      
      <!-- Settings Button -->
      <button 
        aria-label="Settings" 
        class="flex items-center justify-center rounded-md size-8 bg-surface-container-highest text-on-surface hover:bg-surface-variant transition-colors"
        @click="$emit('change-tab', 'settings')"
      >
        <MaterialIcon name="settings" :size="18" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import MaterialIcon from './icons/MaterialIcon.vue'
import type { TabType } from '../types'

defineProps<{
  currentTab: TabType
}>()

defineEmits<{
  (e: 'change-tab', tab: TabType): void
}>()

const tabs = [
  { key: 'download' as TabType, label: '解析下载' },
  { key: 'history' as TabType, label: '下载历史' },
  { key: 'about' as TabType, label: '关于软件' },
]
</script>

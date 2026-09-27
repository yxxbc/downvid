import { ref, readonly } from 'vue'

interface ErrorModalState {
  visible: boolean
  type: 'error' | 'warning' | 'info'
  title: string
  message: string
  detail: string
  /** 可操作的解决建议，醒目展示（不折叠） */
  hint: string
}

const state = ref<ErrorModalState>({
  visible: false,
  type: 'error',
  title: '',
  message: '',
  detail: '',
  hint: '',
})

function showModal(options: {
  type?: 'error' | 'warning' | 'info'
  title?: string
  message: string
  detail?: string
  hint?: string
}) {
  state.value = {
    visible: true,
    type: options.type || 'error',
    title: options.title || '',
    message: options.message,
    detail: options.detail || '',
    hint: options.hint || '',
  }
}

function showError(message: string, detail?: string, hint?: string) {
  showModal({ type: 'error', message, detail, hint })
}

function showWarning(message: string, detail?: string) {
  showModal({ type: 'warning', message, detail })
}

function showInfo(message: string, detail?: string) {
  showModal({ type: 'info', message, detail })
}

function close() {
  state.value.visible = false
}

export function useErrorModal() {
  return {
    state: readonly(state),
    showModal,
    showError,
    showWarning,
    showInfo,
    close,
  }
}

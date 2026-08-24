import { ref, readonly } from 'vue'

interface ErrorModalState {
  visible: boolean
  type: 'error' | 'warning' | 'info'
  title: string
  message: string
  detail: string
}

const state = ref<ErrorModalState>({
  visible: false,
  type: 'error',
  title: '',
  message: '',
  detail: '',
})

function showModal(options: {
  type?: 'error' | 'warning' | 'info'
  title?: string
  message: string
  detail?: string
}) {
  state.value = {
    visible: true,
    type: options.type || 'error',
    title: options.title || '',
    message: options.message,
    detail: options.detail || '',
  }
}

function showError(message: string, detail?: string) {
  showModal({ type: 'error', message, detail })
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

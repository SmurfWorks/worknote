import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

export function showToast(message, variant = 'ok') {
  const now = Date.now()
  const last = toasts.value.at(-1)
  if (last && last.message === message && now - last.at < 1800) return

  const id = ++nextId
  toasts.value = [...toasts.value, { id, message, variant, at: now }]
  window.setTimeout(() => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }, 2200)
}

export function useToasts() {
  return { toasts, showToast }
}

import { ref } from 'vue'

const STORAGE_KEY = 'worknote.onboardingSeen'

function readSeen() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const seen = ref(readSeen())
const open = ref(!seen.value)

export function useOnboarding() {
  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Private mode can block storage; still hide the splash this session.
    }
    seen.value = true
    open.value = false
  }

  function show() {
    open.value = true
  }

  return { open, seen, dismiss, show }
}

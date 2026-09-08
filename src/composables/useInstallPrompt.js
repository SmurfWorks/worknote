import { computed, ref } from 'vue'
import { isAndroid, isIos } from '../lib/device'

const DISMISS_KEY = 'worknote.installPromptDismissed'

const deferred = ref(null)
const isStandalone = ref(false)
const dismissed = ref(false)
let started = false

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function detectStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    Boolean(navigator.standalone)
  )
}

export function startInstallPrompt() {
  if (started || typeof window === 'undefined') return
  started = true
  dismissed.value = readDismissed()
  isStandalone.value = detectStandalone()

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred.value = event
  })
  window.addEventListener('appinstalled', () => {
    deferred.value = null
    isStandalone.value = true
  })

  const standaloneQuery = window.matchMedia('(display-mode: standalone)')
  standaloneQuery.addEventListener?.('change', () => {
    isStandalone.value = detectStandalone()
  })
}

export function useInstallPrompt() {
  startInstallPrompt()

  const canInstall = computed(() => Boolean(deferred.value) && !isStandalone.value)
  const ios = isIos()
  const android = isAndroid()
  const showPrompt = computed(() => {
    if (isStandalone.value || dismissed.value) return false
    return canInstall.value || ios || android
  })

  async function install() {
    if (!deferred.value) return
    await deferred.value.prompt()
    const choice = await deferred.value.userChoice
    deferred.value = null
    if (choice?.outcome === 'accepted') {
      isStandalone.value = true
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Private mode can block storage; still hide this session.
    }
    dismissed.value = true
  }

  return {
    canInstall,
    isStandalone,
    isIos: ios,
    isAndroid: android,
    showPrompt,
    install,
    dismiss,
  }
}

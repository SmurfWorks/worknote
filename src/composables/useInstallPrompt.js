import { computed, ref } from 'vue'
import { isAndroid, isIos } from '../lib/device'

const INSTALLED_KEY = 'worknote.pwaInstalled'

const deferred = ref(null)
const isStandalone = ref(false)
const installed = ref(false)
let started = false

function readInstalled() {
  try {
    return localStorage.getItem(INSTALLED_KEY) === '1'
  } catch {
    return false
  }
}

function persistInstalled() {
  installed.value = true
  try {
    localStorage.setItem(INSTALLED_KEY, '1')
  } catch {
    // Private mode can block storage; still remember this session.
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

function isFileApp() {
  return typeof location !== 'undefined' && location.protocol === 'file:'
}

function syncStandalone() {
  isStandalone.value = detectStandalone()
  if (isStandalone.value) persistInstalled()
}

export function startInstallPrompt() {
  if (started || typeof window === 'undefined') return
  started = true
  installed.value = readInstalled()
  syncStandalone()

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred.value = event
  })
  window.addEventListener('appinstalled', () => {
    deferred.value = null
    persistInstalled()
  })

  for (const mode of ['standalone', 'fullscreen', 'window-controls-overlay']) {
    const query = window.matchMedia(`(display-mode: ${mode})`)
    query.addEventListener?.('change', syncStandalone)
  }
}

export function useInstallPrompt() {
  startInstallPrompt()

  const canUseApp = computed(() => isStandalone.value || isFileApp())
  const canInstall = computed(() => Boolean(deferred.value) && !canUseApp.value)
  const showInstalled = computed(() => installed.value && !canUseApp.value)
  const ios = isIos()
  const android = isAndroid()

  async function install() {
    if (!deferred.value) return
    await deferred.value.prompt()
    const choice = await deferred.value.userChoice
    deferred.value = null
    if (choice?.outcome === 'accepted') persistInstalled()
  }

  return {
    canUseApp,
    canInstall,
    showInstalled,
    isStandalone,
    isIos: ios,
    isAndroid: android,
    install,
  }
}

import { computed, ref } from 'vue'
import { isAndroid, isIos } from '../lib/device'

const INSTALLED_KEY = 'worknote.pwaInstalled'
const DETECT_MS = 2000

const deferred = ref(null)
const isStandalone = ref(false)
const installed = ref(false)
const installing = ref(false)
const detectionReady = ref(false)
let started = false
let detectTimer = null

function readInstalledHint() {
  try {
    return localStorage.getItem(INSTALLED_KEY) === '1'
  } catch {
    return false
  }
}

function persistInstalled() {
  try {
    localStorage.setItem(INSTALLED_KEY, '1')
  } catch {
    // Private mode can block storage; still remember this session.
  }
}

function clearInstalledHint() {
  try {
    localStorage.removeItem(INSTALLED_KEY)
  } catch {
    // Ignore storage failures.
  }
}

function supportsInstallPrompt() {
  return typeof window !== 'undefined' && 'onbeforeinstallprompt' in window
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

function finishDetection() {
  detectionReady.value = true
  if (detectTimer) {
    window.clearTimeout(detectTimer)
    detectTimer = null
  }
}

function markInstalled() {
  installed.value = true
  installing.value = false
  persistInstalled()
  finishDetection()
}

function markNotInstalled() {
  installed.value = false
  installing.value = false
  clearInstalledHint()
  finishDetection()
}

function syncStandalone() {
  isStandalone.value = detectStandalone()
  if (isStandalone.value) markInstalled()
}

async function detectRelatedApps() {
  if (typeof navigator === 'undefined' || !navigator.getInstalledRelatedApps) return
  try {
    const apps = await navigator.getInstalledRelatedApps()
    if (apps.length) {
      markInstalled()
      return
    }
    if (deferred.value) markNotInstalled()
  } catch {
    // Unsupported or blocked; fall through to other signals.
  }
}

function redetect() {
  syncStandalone()
  if (isStandalone.value) return
  void detectRelatedApps()
}

export function startInstallPrompt() {
  if (started || typeof window === 'undefined') return
  started = true
  const hint = readInstalledHint()
  installed.value = false
  installing.value = false
  detectionReady.value = false
  syncStandalone()

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred.value = event
    markNotInstalled()
  })
  window.addEventListener('appinstalled', () => {
    deferred.value = null
    markInstalled()
  })

  for (const mode of ['standalone', 'fullscreen', 'window-controls-overlay']) {
    const query = window.matchMedia(`(display-mode: ${mode})`)
    query.addEventListener?.('change', syncStandalone)
  }

  window.addEventListener('pageshow', redetect)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') redetect()
  })

  void detectRelatedApps()

  detectTimer = window.setTimeout(() => {
    if (detectionReady.value) return
    detectionReady.value = true
    if (hint && !deferred.value && supportsInstallPrompt() && !isIos()) {
      installed.value = true
    }
  }, DETECT_MS)
}

export function useInstallPrompt() {
  startInstallPrompt()

  const canUseApp = computed(() => isStandalone.value || isFileApp())
  const canInstall = computed(() => Boolean(deferred.value) && !canUseApp.value && !installing.value)
  const showInstalled = computed(
    () => detectionReady.value && installed.value && !canUseApp.value && !installing.value,
  )
  const ios = isIos()
  const android = isAndroid()

  async function install() {
    if (!deferred.value || installing.value) return
    installing.value = true
    const promptEvent = deferred.value
    try {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      deferred.value = null
      if (choice?.outcome !== 'accepted') {
        installing.value = false
        return
      }
      if (installed.value) installing.value = false
    } catch {
      installing.value = false
    }
  }

  return {
    canUseApp,
    canInstall,
    showInstalled,
    installing,
    isStandalone,
    isIos: ios,
    isAndroid: android,
    install,
  }
}

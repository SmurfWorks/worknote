import { computed, onMounted, onUnmounted, ref } from 'vue'

export function useInstallPrompt() {
  const deferred = ref(null)
  const isStandalone = ref(false)

  const canInstall = computed(() => Boolean(deferred.value) && !isStandalone.value)

  function checkStandalone() {
    isStandalone.value =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean(navigator.standalone)
  }

  function onPrompt(event) {
    event.preventDefault()
    deferred.value = event
  }

  async function install() {
    if (!deferred.value) return
    await deferred.value.prompt()
    await deferred.value.userChoice
    deferred.value = null
    checkStandalone()
  }

  onMounted(() => {
    checkStandalone()
    window.addEventListener('beforeinstallprompt', onPrompt)
  })

  onUnmounted(() => {
    window.removeEventListener('beforeinstallprompt', onPrompt)
  })

  return {
    canInstall,
    isStandalone,
    install,
  }
}

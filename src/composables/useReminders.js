import { onMounted, ref } from 'vue'
import { getSettings } from '../lib/db'
import {
  getServiceWorkerRegistration,
  maybeNotifyFromPage,
  nextReminderAt,
  scheduleTimestampTrigger,
} from '../lib/reminders'

let timeoutId = null
let started = false

async function registerPeriodicSync() {
  const registration = await getServiceWorkerRegistration()
  if (!registration?.periodicSync) return
  try {
    await registration.periodicSync.register('worknote-reminder', {
      minInterval: 15 * 60 * 1000,
    })
  } catch {
    // Not installed as a PWA, or the browser denied background sync.
  }
}

async function armForegroundTimer() {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }

  const settings = await getSettings()
  const next = nextReminderAt(settings)
  if (!next) return

  const delay = Math.max(next.getTime() - Date.now(), 0)
  timeoutId = setTimeout(() => {
    maybeNotifyFromPage().then(() => armForegroundTimer())
  }, delay)
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    maybeNotifyFromPage()
    armForegroundTimer()
  }
}

export function useReminders() {
  const permission = ref(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission,
  )

  async function requestPermission() {
    if (typeof Notification === 'undefined') {
      permission.value = 'denied'
      return permission.value
    }
    permission.value = await Notification.requestPermission()
    if (permission.value === 'granted') {
      await registerPeriodicSync()
      await scheduleTimestampTrigger()
      await maybeNotifyFromPage()
    }
    return permission.value
  }

  async function refreshSchedule() {
    await armForegroundTimer()
    await scheduleTimestampTrigger()
    await registerPeriodicSync()
    const registration = await getServiceWorkerRegistration()
    registration?.active?.postMessage('check-reminder')
  }

  async function startReminderLoop() {
    if (started) {
      await refreshSchedule()
      return
    }
    started = true
    permission.value =
      typeof Notification === 'undefined' ? 'denied' : Notification.permission
    await maybeNotifyFromPage()
    await refreshSchedule()
    document.addEventListener('visibilitychange', onVisibilityChange)
    setInterval(() => {
      maybeNotifyFromPage()
    }, 60_000)
  }

  onMounted(() => {
    permission.value =
      typeof Notification === 'undefined' ? 'denied' : Notification.permission
  })

  return {
    permission,
    requestPermission,
    refreshSchedule,
    startReminderLoop,
  }
}

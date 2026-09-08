import { onMounted, ref } from 'vue'
import { getSettings } from '../lib/db'
import {
  getServiceWorkerRegistration,
  maybeNotifyFromPage,
  nextReminderAt,
  scheduleTimestampTrigger,
  sendTestNotification,
} from '../lib/reminders'

let timeoutId = null
let started = false
const backgroundReady = ref(false)

async function registerPeriodicSync() {
  const registration = await getServiceWorkerRegistration()
  if (!registration?.periodicSync) return false
  try {
    await registration.periodicSync.register('worknote-reminder', {
      minInterval: 15 * 60 * 1000,
    })
    return true
  } catch {
    return false
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
  maybeNotifyFromPage()
  if (document.visibilityState === 'visible') {
    armForegroundTimer()
    registerPeriodicSync()
  }
}

export function useReminders() {
  const permission = ref(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission,
  )

  async function refreshBackgroundReady() {
    const registration = await getServiceWorkerRegistration()
    if (!registration?.periodicSync) {
      backgroundReady.value = false
      return
    }
    try {
      const tags = await registration.periodicSync.getTags()
      backgroundReady.value = tags.includes('worknote-reminder')
    } catch {
      backgroundReady.value = false
    }
  }

  async function requestPermission() {
    if (typeof Notification === 'undefined') {
      permission.value = 'denied'
      return permission.value
    }
    permission.value = await Notification.requestPermission()
    if (permission.value === 'granted') {
      await registerPeriodicSync()
      await refreshBackgroundReady()
      await scheduleTimestampTrigger()
      await sendTestNotification()
    }
    return permission.value
  }

  async function refreshSchedule() {
    await armForegroundTimer()
    await scheduleTimestampTrigger()
    await registerPeriodicSync()
    await refreshBackgroundReady()
  }

  async function startReminderLoop() {
    if (started) {
      await refreshSchedule()
      return
    }
    started = true
    permission.value =
      typeof Notification === 'undefined' ? 'denied' : Notification.permission
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
    backgroundReady,
    requestPermission,
    refreshSchedule,
    startReminderLoop,
  }
}

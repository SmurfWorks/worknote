import { getNote, getSettings, noteHasContent, saveSettings } from './db'
import { todayKey } from './dates'

export function nextReminderAt(settings, from = new Date()) {
  if (!settings.remindersEnabled || settings.days.length === 0) return null
  const [hours, minutes] = settings.time.split(':').map(Number)
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(from)
    candidate.setDate(from.getDate() + offset)
    candidate.setSeconds(0, 0)
    candidate.setMilliseconds(0)
    candidate.setHours(hours, minutes, 0, 0)
    if (!settings.days.includes(candidate.getDay())) continue
    if (candidate.getTime() > from.getTime()) return candidate
  }
  return null
}

export async function isPastReminderTime(now = new Date()) {
  const settings = await getSettings()
  if (!settings.remindersEnabled) return false
  if (!settings.days.includes(now.getDay())) return false
  const [hours, minutes] = settings.time.split(':').map(Number)
  const reminder = new Date(now)
  reminder.setHours(hours, minutes, 0, 0)
  return now.getTime() >= reminder.getTime()
}

export async function shouldNudgeToday(now = new Date()) {
  if (!(await isPastReminderTime(now))) return false
  const note = await getNote(todayKey(now))
  return !noteHasContent(note)
}

export async function shouldSendNotification(now = new Date()) {
  if (!(await shouldNudgeToday(now))) return false
  const settings = await getSettings()
  return settings.lastNotifiedDate !== todayKey(now)
}

export async function markNotified(date = todayKey()) {
  const settings = await getSettings()
  settings.lastNotifiedDate = date
  await saveSettings(settings)
}

const NOTIFICATION_TITLE = 'Worknote'
const NOTIFICATION_BODY = 'Record a quick note about what you worked on today.'

function notificationIcon() {
  const base =
    typeof document !== 'undefined'
      ? document.baseURI
      : globalThis.registration?.scope ?? globalThis.location?.href
  try {
    return new URL('icon.svg', base).href
  } catch {
    return undefined
  }
}

export async function getServiceWorkerRegistration() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined
  if (typeof location !== 'undefined' && location.protocol === 'file:') return undefined
  return navigator.serviceWorker.getRegistration()
}

export async function maybeNotifyFromServiceWorker(registration) {
  if (!(await shouldSendNotification())) return false
  await registration.showNotification(NOTIFICATION_TITLE, {
    body: NOTIFICATION_BODY,
    tag: 'worknote-daily',
    icon: notificationIcon(),
    data: { url: './' },
  })
  await markNotified()
  return true
}

export async function maybeNotifyFromPage() {
  if (!(await shouldSendNotification())) return false
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false
  }

  const registration = await getServiceWorkerRegistration()
  if (registration?.showNotification) {
    await registration.showNotification(NOTIFICATION_TITLE, {
      body: NOTIFICATION_BODY,
      tag: 'worknote-daily',
      icon: notificationIcon(),
    })
  } else {
    new Notification(NOTIFICATION_TITLE, {
      body: NOTIFICATION_BODY,
      tag: 'worknote-daily',
      icon: notificationIcon(),
    })
  }

  await markNotified()
  return true
}

export async function scheduleTimestampTrigger() {
  const settings = await getSettings()
  const next = nextReminderAt(settings)
  if (!next || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return
  }

  const Trigger = globalThis.TimestampTrigger
  if (!Trigger) return

  const registration = await getServiceWorkerRegistration()
  if (!registration?.showNotification) return

  await registration.showNotification(NOTIFICATION_TITLE, {
    body: NOTIFICATION_BODY,
    tag: 'worknote-scheduled',
    icon: notificationIcon(),
    showTrigger: new Trigger(next.getTime()),
  })
}

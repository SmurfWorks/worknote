import { getNote, getSettings, noteHasContent, saveSettings } from './db'
import { todayKey } from './dates'
import { reminderTimes } from './types'

export function nextReminderAt(settings, from = new Date()) {
  if (!settings.remindersEnabled || settings.days.length === 0) return null
  const times = reminderTimes(settings)
  if (times.length === 0) return null
  for (let offset = 0; offset < 8; offset += 1) {
    const day = new Date(from)
    day.setDate(from.getDate() + offset)
    if (!settings.days.includes(day.getDay())) continue
    for (const time of times) {
      const [hours, minutes] = time.split(':').map(Number)
      const candidate = new Date(day)
      candidate.setHours(hours, minutes, 0, 0)
      if (candidate.getTime() > from.getTime()) return candidate
    }
  }
  return null
}

function slotKey(date, time) {
  return `${date}T${time}`
}

export function latestPastReminderSlot(settings, now = new Date()) {
  if (!settings.remindersEnabled || !settings.days.includes(now.getDay())) return null
  const date = todayKey(now)
  let latest = null
  for (const time of reminderTimes(settings)) {
    const [hours, minutes] = time.split(':').map(Number)
    const at = new Date(now)
    at.setHours(hours, minutes, 0, 0)
    if (now.getTime() >= at.getTime()) latest = slotKey(date, time)
  }
  return latest
}

export function dueReminderSlot(settings, now = new Date()) {
  if (!settings.remindersEnabled || !settings.days.includes(now.getDay())) return null
  const times = reminderTimes(settings)
  if (times.length === 0) return null
  const date = todayKey(now)
  const nowMs = now.getTime()
  const checked = settings.lastReminderCheckAt ? new Date(settings.lastReminderCheckAt).getTime() : nowMs
  const lastCheckMs = Number.isNaN(checked) ? nowMs : checked
  let due = null
  for (const time of times) {
    const [hours, minutes] = time.split(':').map(Number)
    const at = new Date(now)
    at.setHours(hours, minutes, 0, 0)
    const atMs = at.getTime()
    if (atMs > lastCheckMs && atMs <= nowMs) due = slotKey(date, time)
  }
  return due
}

export async function isPastReminderTime(now = new Date()) {
  const settings = await getSettings()
  return Boolean(latestPastReminderSlot(settings, now))
}

export async function shouldNudgeToday(now = new Date()) {
  if (!(await isPastReminderTime(now))) return false
  const note = await getNote(todayKey(now))
  return !noteHasContent(note)
}

export async function shouldSendNotification(now = new Date()) {
  const settings = await getSettings()
  const slot = dueReminderSlot(settings, now)
  if (!slot || settings.lastNotifiedSlot === slot) return false
  const note = await getNote(todayKey(now))
  return !noteHasContent(note)
}

export async function markNotified(date = todayKey(), slot = null) {
  const settings = await getSettings()
  const now = new Date()
  settings.lastNotifiedDate = date
  settings.lastNotifiedSlot = slot ?? dueReminderSlot(settings, now) ?? latestPastReminderSlot(settings, now)
  settings.lastReminderCheckAt = now.toISOString()
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
    return new URL('icon-192.png', base).href
  } catch {
    return undefined
  }
}

function reminderOptions(tag = 'worknote-daily') {
  return {
    body: NOTIFICATION_BODY,
    tag,
    icon: notificationIcon(),
    badge: notificationIcon(),
    vibrate: [120, 80, 120],
    renotify: true,
    data: { url: './' },
  }
}

async function showReminderNotification(registration, extra = {}) {
  const options = { ...reminderOptions(extra.tag ?? 'worknote-daily'), ...extra }
  try {
    await registration.showNotification(NOTIFICATION_TITLE, options)
  } catch {
    delete options.icon
    delete options.badge
    await registration.showNotification(NOTIFICATION_TITLE, options)
  }
}

export async function getServiceWorkerRegistration() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined
  if (typeof location !== 'undefined' && location.protocol === 'file:') return undefined

  const current = await navigator.serviceWorker.getRegistration()
  if (current?.active) return current

  if (typeof document !== 'undefined' && document.readyState !== 'complete') {
    await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }))
  }

  const registered = current ?? (await navigator.serviceWorker.getRegistration())
  if (!registered) return undefined
  if (registered.active) return registered
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return registered
  }
}

export async function maybeNotifyFromServiceWorker(registration) {
  if (!(await shouldSendNotification())) return false
  await showReminderNotification(registration)
  await markNotified()
  return true
}

export async function maybeNotifyFromPage() {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return false
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false
  }
  if (!(await shouldSendNotification())) return false

  const registration = await getServiceWorkerRegistration()
  try {
    if (registration?.showNotification) {
      await showReminderNotification(registration)
    } else {
      new Notification(NOTIFICATION_TITLE, reminderOptions())
    }
  } catch {
    return false
  }

  await markNotified()
  return true
}

export async function sendTestNotification() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false
  }
  const registration = await getServiceWorkerRegistration()
  const options = {
    body: 'Reminders are on. We’ll nudge you at the times you picked.',
    tag: 'worknote-test',
    icon: notificationIcon(),
    badge: notificationIcon(),
    vibrate: [80, 40, 80],
    data: { url: './' },
  }
  try {
    if (registration?.showNotification) {
      await registration.showNotification(NOTIFICATION_TITLE, options)
    } else {
      new Notification(NOTIFICATION_TITLE, options)
    }
    return true
  } catch {
    try {
      delete options.icon
      delete options.badge
      if (registration?.showNotification) {
        await registration.showNotification(NOTIFICATION_TITLE, options)
      } else {
        new Notification(NOTIFICATION_TITLE, options)
      }
      return true
    } catch {
      return false
    }
  }
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

  await showReminderNotification(registration, {
    tag: 'worknote-scheduled',
    showTrigger: new Trigger(next.getTime()),
  })
}

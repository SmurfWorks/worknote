import { getNote, getSettings, noteHasContent } from './db'
import { todayKey } from './dates'
import { REMINDER_GRACE_MINUTES } from './push'
import { reminderTimes } from './types'

/** Reminders are booked on the server this many days ahead, so they arrive while Worknote is closed. */
export const REMINDER_LOOKAHEAD_DAYS = 7

const NOTIFICATION_TITLE = 'Worknote'
const NOTIFICATION_BODY = 'Record a quick note about what you worked on today.'

function atLocalTime(day, time) {
  const [hours, minutes] = time.split(':').map(Number)
  const at = new Date(day)
  at.setHours(hours, minutes, 0, 0)
  return at
}

export function latestPastReminderSlot(settings, now = new Date()) {
  if (!settings.remindersEnabled || !settings.days.includes(now.getDay())) return null
  const date = todayKey(now)
  let latest = null
  for (const time of reminderTimes(settings)) {
    if (now.getTime() >= atLocalTime(now, time).getTime()) latest = `${date}T${time}`
  }
  return latest
}

export async function shouldNudgeToday(now = new Date()) {
  const settings = await getSettings()
  if (!latestPastReminderSlot(settings, now)) return false
  const note = await getNote(todayKey(now))
  return !noteHasContent(note)
}

/**
 * Reminders to book on the server from `now`: each chosen time on each chosen day in the lookahead,
 * except days that already have a note. A time that passed within the grace period is still booked,
 * so a reminder the server has not sent yet is not withdrawn.
 */
export function scheduledReminders(settings, notedDates, now = new Date()) {
  if (!settings.remindersEnabled || settings.days.length === 0) return []
  const graceMs = REMINDER_GRACE_MINUTES * 60 * 1000
  const booked = []
  for (let offset = 0; offset < REMINDER_LOOKAHEAD_DAYS; offset += 1) {
    const day = new Date(now)
    day.setDate(now.getDate() + offset)
    if (!settings.days.includes(day.getDay())) continue
    const date = todayKey(day)
    if (notedDates.has(date)) continue
    for (const time of reminderTimes(settings)) {
      const at = atLocalTime(day, time)
      if (now.getTime() - at.getTime() > graceMs) continue
      booked.push({
        key: `note-${date}-${time}`,
        deliverAt: at.toISOString(),
        title: NOTIFICATION_TITLE,
        body: NOTIFICATION_BODY,
        tag: 'worknote-daily',
      })
    }
  }
  return booked
}

function notificationIcon() {
  try {
    return new URL('icon-192.png', document.baseURI).href
  } catch {
    return undefined
  }
}

export async function getServiceWorkerRegistration() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined
  if (typeof location !== 'undefined' && location.protocol === 'file:') return undefined
  const current = await navigator.serviceWorker.getRegistration()
  if (current?.active || !current) return current
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return current
  }
}

/** Shows a notification from this phone, without the server, to confirm notifications appear. */
export async function sendTestNotification() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false
  }
  const registration = await getServiceWorkerRegistration()
  const options = {
    body: 'Notifications work. Reminders come from your reminder server at the times you picked.',
    tag: 'worknote-test',
    icon: notificationIcon(),
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
    return false
  }
}

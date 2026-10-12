import { getNote, getSettings, noteHasContent } from './db'
import { todayKey } from './dates'
import { REMINDER_GRACE_MINUTES } from './push'
import { zonedClock } from './timezone'
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

/** `date` (YYYY-MM-DD) moved by `days`, with its weekday (0 is Sunday). */
function calendarDay(date, days) {
  const [year, month, day] = date.split('-').map(Number)
  const at = new Date(Date.UTC(year, month - 1, day + days))
  return { date: at.toISOString().slice(0, 10), weekday: at.getUTCDay() }
}

/**
 * Reminders to book on the server from `now`: each chosen time on each chosen day in the lookahead,
 * except days that already have a note. Days and times are in the timezone registered with the
 * server, and each is booked as a clock time, which the server reads in that timezone. A time that
 * passed within the grace period is still booked, so a reminder not yet sent is not withdrawn.
 */
export function scheduledReminders(settings, notedDates, now = new Date()) {
  if (!settings.remindersEnabled || settings.days.length === 0) return []
  const today = zonedClock(settings.timezone, now).slice(0, 10)
  const earliest = zonedClock(settings.timezone, new Date(now.getTime() - REMINDER_GRACE_MINUTES * 60 * 1000))
  const booked = []
  for (let offset = 0; offset < REMINDER_LOOKAHEAD_DAYS; offset += 1) {
    const { date, weekday } = calendarDay(today, offset)
    if (!settings.days.includes(weekday) || notedDates.has(date)) continue
    for (const time of reminderTimes(settings)) {
      const clock = `${date}T${time}`
      if (clock < earliest) continue
      booked.push({
        key: `note-${date}-${time}`,
        deliverAt: `${clock}:00`,
        title: NOTIFICATION_TITLE,
        body: NOTIFICATION_BODY,
        tag: 'worknote-daily',
      })
    }
  }
  return booked
}

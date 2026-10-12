import { getSettings, listEntryTimes } from './db'
import { REMINDER_GRACE_MINUTES } from './push'
import { zonedClock } from './timezone'
import { reminderTimes } from './types'

/** Reminders are booked on the server this many days ahead, so they arrive while Worknote is closed. */
export const REMINDER_LOOKAHEAD_DAYS = 7

const NOTIFICATION_TITLE = 'Worknote'
const NOTIFICATION_BODY = 'Write a quick note about what you worked on today.'

function atLocalTime(day, time) {
  const [hours, minutes] = time.split(':').map(Number)
  const at = new Date(day)
  at.setHours(hours, minutes, 0, 0)
  return at
}

/**
 * Whether an entry was written in the window a reminder covers: from the reminder before it that day,
 * or from midnight for the first one, up to `until`. Times are wall clocks (`YYYY-MM-DDTHH:MM`) in
 * one timezone, so they compare as strings.
 */
function wroteInWindow(entryClocks, date, times, index, until) {
  const from = index === 0 ? `${date}T00:00` : `${date}T${times[index - 1]}`
  return entryClocks.some((clock) => clock >= from && clock < until)
}

function entryClocks(entryTimes, timeZone) {
  return entryTimes.map((at) => zonedClock(timeZone, new Date(at)))
}

/**
 * True once today's latest reminder time has passed with no entry written since the reminder before it
 * (or since midnight, for the first), which is when a reminder would have gone out.
 */
export async function shouldNudgeToday(now = new Date()) {
  const settings = await getSettings()
  const today = zonedClock(settings.timezone, now).slice(0, 10)
  if (!settings.remindersEnabled || !settings.days.includes(calendarDay(today, 0).weekday)) return false
  const times = reminderTimes(settings)
  const nowClock = zonedClock(settings.timezone, now)
  let latest = -1
  times.forEach((time, index) => {
    if (`${today}T${time}` <= nowClock) latest = index
  })
  if (latest < 0) return false
  const clocks = entryClocks(await listEntryTimes(), settings.timezone)
  return !wroteInWindow(clocks, today, times, latest, `${nowClock}~`)
}

/** `date` (YYYY-MM-DD) moved by `days`, with its weekday (0 is Sunday). */
function calendarDay(date, days) {
  const [year, month, day] = date.split('-').map(Number)
  const at = new Date(Date.UTC(year, month - 1, day + days))
  return { date: at.toISOString().slice(0, 10), weekday: at.getUTCDay() }
}

/**
 * Reminders to book on the server from `now`: each chosen time on each chosen day in the lookahead,
 * unless an entry was written since the reminder before it that day, or since midnight for the first.
 * `entryTimes` are when entries were written (ISO). Days and times are in the timezone registered with
 * the server, and each is booked as a clock time, which the server reads in that timezone. A time that
 * passed within the grace period is still booked, so a reminder not yet sent is not withdrawn.
 */
export function scheduledReminders(settings, entryTimes, now = new Date()) {
  if (!settings.remindersEnabled || settings.days.length === 0) return []
  const today = zonedClock(settings.timezone, now).slice(0, 10)
  const earliest = zonedClock(settings.timezone, new Date(now.getTime() - REMINDER_GRACE_MINUTES * 60 * 1000))
  const clocks = entryClocks(entryTimes, settings.timezone)
  const times = reminderTimes(settings)
  const booked = []
  for (let offset = 0; offset < REMINDER_LOOKAHEAD_DAYS; offset += 1) {
    const { date, weekday } = calendarDay(today, offset)
    if (!settings.days.includes(weekday)) continue
    for (const [index, time] of times.entries()) {
      const clock = `${date}T${time}`
      if (clock < earliest) continue
      if (wroteInWindow(clocks, date, times, index, clock)) continue
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

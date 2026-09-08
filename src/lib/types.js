export const WEEKDAYS = [
  { value: 1, label: 'Mon', full: 'Monday' },
  { value: 2, label: 'Tue', full: 'Tuesday' },
  { value: 3, label: 'Wed', full: 'Wednesday' },
  { value: 4, label: 'Thu', full: 'Thursday' },
  { value: 5, label: 'Fri', full: 'Friday' },
  { value: 6, label: 'Sat', full: 'Saturday' },
  { value: 0, label: 'Sun', full: 'Sunday' },
]

export const DEFAULT_SETTINGS = {
  days: [1, 2, 3, 4, 5],
  times: ['17:00'],
  time: '17:00',
  remindersEnabled: true,
  lastNotifiedDate: null,
  lastNotifiedSlot: null,
}

export function normalizeTime(value) {
  const match = String(value ?? '').match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function reminderTimes(settings) {
  const values = [
    ...(Array.isArray(settings?.times) ? settings.times : []),
    ...(settings?.time ? [settings.time] : []),
  ]
  const unique = [...new Set(values.map(normalizeTime).filter(Boolean))]
  unique.sort()
  return unique.length ? unique : [...DEFAULT_SETTINGS.times]
}

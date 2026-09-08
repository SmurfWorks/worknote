export function todayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(key) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDisplayDate(key) {
  return parseDateKey(key).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function formatShortDate(key) {
  return parseDateKey(key).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function formatTime(date = new Date()) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function shiftDateKey(key, deltaDays) {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + deltaDays)
  return todayKey(date)
}

export function dateRelation(key, from = new Date()) {
  const today = todayKey(from)
  if (key === today) return 'today'
  if (key === shiftDateKey(today, -1)) return 'yesterday'
  if (key === shiftDateKey(today, 1)) return 'tomorrow'
  return key < today ? 'earlier' : 'upcoming'
}

export function dateRelationLabel(key, from = new Date()) {
  const labels = {
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
    earlier: 'Earlier',
    upcoming: 'Upcoming',
  }
  return labels[dateRelation(key, from)]
}

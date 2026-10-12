// A Worknote backup file: every day's entries, as JSON. Reminder settings, the timezone and the reminder
// server belong to the device, so they are not included.

export const BACKUP_VERSION = 1

const UNREADABLE = 'That file is not a Worknote backup.'
const NEWER = 'That backup is from a newer version of Worknote.'
const DATE = /^\d{4}-\d{2}-\d{2}$/

export function createBackup(notes, exportedAt = new Date()) {
  return {
    app: 'worknote',
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    notes: notes.map((note) => ({
      date: note.date,
      entries: note.entries.map(({ id, text, createdAt, updatedAt }) => ({ id, text, createdAt, updatedAt })),
    })),
  }
}

export function backupFilename(when = new Date()) {
  const year = when.getFullYear()
  const month = String(when.getMonth() + 1).padStart(2, '0')
  const day = String(when.getDate()).padStart(2, '0')
  return `worknote-backup-${year}-${month}-${day}.json`
}

function readTime(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null
}

function readEntry(value) {
  if (!value || typeof value !== 'object') return null
  if (typeof value.id !== 'string' || !value.id || typeof value.text !== 'string') return null
  const createdAt = readTime(value.createdAt)
  return { id: value.id, text: value.text, createdAt, updatedAt: readTime(value.updatedAt) ?? createdAt }
}

/** `{ ok: true, notes }` for a readable backup, or `{ ok: false, message }`. */
export function parseBackup(value) {
  if (!value || typeof value !== 'object' || value.app !== 'worknote') return { ok: false, message: UNREADABLE }
  if (value.version !== BACKUP_VERSION) {
    return { ok: false, message: typeof value.version === 'number' && value.version > BACKUP_VERSION ? NEWER : UNREADABLE }
  }
  if (!readTime(value.exportedAt) || !Array.isArray(value.notes)) return { ok: false, message: UNREADABLE }
  const notes = []
  const dates = new Set()
  for (const note of value.notes) {
    if (!note || typeof note !== 'object' || !DATE.test(note.date) || dates.has(note.date)) {
      return { ok: false, message: UNREADABLE }
    }
    if (!Array.isArray(note.entries)) return { ok: false, message: UNREADABLE }
    const entries = note.entries.map(readEntry)
    if (entries.some((entry) => entry === null)) return { ok: false, message: UNREADABLE }
    dates.add(note.date)
    const kept = entries.filter((entry) => entry.text.trim())
    if (kept.length) notes.push({ date: note.date, entries: kept })
  }
  return { ok: true, notes, exportedAt: value.exportedAt }
}

import { openDB } from 'idb'
import { cleanPushUrl } from './push'
import { chosenTimezone } from './timezone'
import { DEFAULT_SETTINGS, reminderTimes } from './types'

const SETTINGS_KEY = 'settings'

function getDb() {
  return openDB('worknote', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'date' })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta')
      }
    },
  })
}

function hydrateSettings(stored) {
  const times = stored ? reminderTimes(stored) : [...DEFAULT_SETTINGS.times]
  return {
    ...DEFAULT_SETTINGS,
    days: stored?.days?.length ? [...stored.days] : [...DEFAULT_SETTINGS.days],
    times,
    time: times[0] ?? null,
    remindersEnabled: stored?.remindersEnabled === true,
    pushUrl: typeof stored?.pushUrl === 'string' ? cleanPushUrl(stored.pushUrl) : '',
    pushToken: typeof stored?.pushToken === 'string' ? stored.pushToken.trim() : '',
    timezone: chosenTimezone(typeof stored?.timezone === 'string' ? stored.timezone : null),
  }
}

export async function getSettings() {
  const db = await getDb()
  const stored = await db.get('meta', SETTINGS_KEY)
  return hydrateSettings(stored)
}

export async function saveSettings(settings) {
  const db = await getDb()
  const times = reminderTimes({ times: settings.times })
  await db.put(
    'meta',
    {
      days: [...settings.days],
      times,
      time: times[0] ?? null,
      remindersEnabled: settings.remindersEnabled === true,
      pushUrl: cleanPushUrl(settings.pushUrl),
      pushToken: String(settings.pushToken ?? '').trim(),
      timezone: chosenTimezone(settings.timezone),
    },
    SETTINGS_KEY,
  )
}

function newEntryId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** A day's entries, from a stored record. Days saved before entries existed hold one `transcript`. */
function readEntries(stored) {
  if (Array.isArray(stored?.entries)) {
    return stored.entries
      .filter((entry) => typeof entry?.text === 'string')
      .map((entry) => ({
        id: typeof entry.id === 'string' ? entry.id : newEntryId(),
        text: entry.text,
        createdAt: entry.createdAt ?? stored.createdAt ?? null,
        updatedAt: entry.updatedAt ?? entry.createdAt ?? null,
      }))
  }
  const text = typeof stored?.transcript === 'string' ? stored.transcript : ''
  if (!text.trim()) return []
  return [{ id: newEntryId(), text, createdAt: stored.createdAt ?? null, updatedAt: stored.updatedAt ?? null }]
}

function readDay(stored) {
  return stored ? { date: stored.date, entries: readEntries(stored) } : null
}

export function createEntry(text, now = new Date()) {
  const at = now.toISOString()
  return { id: newEntryId(), text, createdAt: at, updatedAt: at }
}

/** Note writes run in order, and reads wait for them, so a screen opened as another saves sees the save. */
let noteWrites = Promise.resolve()

/** A day's note: `{ date, entries: [{ id, text, createdAt, updatedAt }] }`, or undefined. */
export async function getNote(date) {
  await noteWrites
  const db = await getDb()
  return readDay(await db.get('notes', date)) ?? undefined
}

export function saveNote(note) {
  const write = noteWrites.then(() => writeNote(note))
  noteWrites = write.catch(() => {})
  return write
}

async function writeNote(note) {
  const db = await getDb()
  const key = note.date
  const entries = (note.entries ?? []).filter((entry) => entry.text.trim())
  if (entries.length === 0) {
    const existed = Boolean(await db.get('notes', key))
    if (existed) await db.delete('notes', key)
    return existed ? 'removed' : 'empty'
  }
  await db.put('notes', {
    date: key,
    entries: entries.map(({ id, text, createdAt, updatedAt }) => ({ id, text, createdAt, updatedAt })),
  })
  return 'saved'
}

export async function deleteNote(date) {
  const db = await getDb()
  await db.delete('notes', date)
}

/** When each entry was written (ISO), on any day, for the reminder rules. */
export async function listEntryTimes() {
  await noteWrites
  const db = await getDb()
  const times = []
  for (const record of await db.getAll('notes')) {
    for (const entry of readEntries(record)) {
      if (entry.text.trim() && entry.createdAt) times.push(entry.createdAt)
    }
  }
  return times
}

export async function listNotes() {
  await noteWrites
  const db = await getDb()
  const stored = await db.getAll('notes')
  const kept = []
  for (const record of stored) {
    const day = readDay(record)
    if (noteHasContent(day)) {
      kept.push(day)
    } else {
      await db.delete('notes', record.date)
    }
  }
  return kept.sort((a, b) => b.date.localeCompare(a.date))
}

export function noteHasContent(note) {
  if (!note) return false
  return (note.entries ?? []).some((entry) => entry.text.trim())
}

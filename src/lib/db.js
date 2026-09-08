import { openDB } from 'idb'
import { DEFAULT_SETTINGS, normalizeTime, reminderTimes } from './types'

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
  const times = reminderTimes(stored ?? {})
  const lastNotifiedDate = stored?.lastNotifiedDate ?? null
  const lastNotifiedSlot =
    stored?.lastNotifiedSlot ??
    (lastNotifiedDate && stored?.time ? `${lastNotifiedDate}T${normalizeTime(stored.time) ?? stored.time}` : null)
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    days: stored?.days?.length ? [...stored.days] : [...DEFAULT_SETTINGS.days],
    times,
    time: times[0],
    lastNotifiedDate,
    lastNotifiedSlot,
    lastReminderCheckAt: stored?.lastReminderCheckAt ?? null,
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
      time: times[0],
      remindersEnabled: settings.remindersEnabled,
      lastNotifiedDate: settings.lastNotifiedDate ?? null,
      lastNotifiedSlot: settings.lastNotifiedSlot ?? null,
      lastReminderCheckAt: settings.lastReminderCheckAt ?? null,
    },
    SETTINGS_KEY,
  )
}

export async function getNote(date) {
  const db = await getDb()
  return db.get('notes', date)
}

export async function saveNote(note) {
  const db = await getDb()
  const key = note.date
  if (!noteHasContent(note)) {
    const existed = Boolean(await db.get('notes', key))
    if (existed) await db.delete('notes', key)
    return existed ? 'removed' : 'empty'
  }
  await db.put('notes', {
    date: note.date,
    audioBlob: note.audioBlob ?? null,
    audioMimeType: note.audioMimeType ?? null,
    transcript: note.transcript ?? '',
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  })
  return 'saved'
}

export async function deleteNote(date) {
  const db = await getDb()
  await db.delete('notes', date)
}

export async function listNotes() {
  const db = await getDb()
  const notes = await db.getAll('notes')
  const kept = []
  for (const note of notes) {
    if (noteHasContent(note)) {
      kept.push(note)
    } else {
      await db.delete('notes', note.date)
    }
  }
  return kept.sort((a, b) => b.date.localeCompare(a.date))
}

export function noteHasContent(note) {
  if (!note) return false
  return Boolean(note.audioBlob) || Boolean(note.transcript?.trim())
}

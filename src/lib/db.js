import { openDB } from 'idb'
import { DEFAULT_SETTINGS } from './types'

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

export async function getSettings() {
  const db = await getDb()
  const stored = await db.get('meta', SETTINGS_KEY)
  if (!stored) return { ...DEFAULT_SETTINGS, days: [...DEFAULT_SETTINGS.days] }
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    days: stored.days?.length ? [...stored.days] : [...DEFAULT_SETTINGS.days],
  }
}

export async function saveSettings(settings) {
  const db = await getDb()
  await db.put(
    'meta',
    {
      days: [...settings.days],
      time: settings.time,
      remindersEnabled: settings.remindersEnabled,
      lastNotifiedDate: settings.lastNotifiedDate ?? null,
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

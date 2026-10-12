<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { listNotes } from '../lib/db'
import { isDateKey, todayKey, formatShortDate } from '../lib/dates'

const router = useRouter()
const notes = ref([])
const loading = ref(true)
const newDate = ref(todayKey())

onMounted(async () => {
  notes.value = await listNotes()
  loading.value = false
})

/** The day's entries in the order they were written, run together and cut short. */
function excerpt(note) {
  const clean = [...note.entries]
    .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')))
    .map((entry) => entry.text.trim())
    .filter(Boolean)
    .join(' · ')
  return clean.length > 140 ? `${clean.slice(0, 137)}…` : clean
}

function entryCount(note) {
  const count = note.entries.filter((entry) => entry.text.trim()).length
  return count === 1 ? '1 entry' : `${count} entries`
}

function openDay() {
  if (!isDateKey(newDate.value)) return
  if (newDate.value === todayKey()) {
    router.push('/')
    return
  }
  router.push({ path: '/', query: { date: newDate.value } })
}
</script>

<template>
  <section>
    <p class="text-sm font-bold uppercase tracking-[0.14em] text-accent">Review</p>
    <h1 class="mt-1 font-display text-3xl text-ink">History</h1>
    <p class="mt-2 text-sm leading-6 text-muted">
      Every saved day on this device, newest first. Add a past or future date any time.
    </p>

    <form class="mt-6 rounded-3xl border border-line bg-card p-4" @submit.prevent="openDay">
      <label class="block text-sm font-medium text-ink" for="history-date">Add a day</label>
      <p class="mt-1 text-sm text-muted">Open a previous or upcoming date to write a note.</p>
      <div class="mt-3 flex gap-2">
        <input
          id="history-date"
          v-model="newDate"
          type="date"
          class="min-w-0 flex-1 rounded-2xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
        />
        <button
          type="submit"
          class="rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-on-accent"
        >
          Open
        </button>
      </div>
    </form>

    <p v-if="loading" class="mt-10 text-sm text-muted">Loading…</p>

    <p
      v-else-if="notes.length === 0"
      class="mt-10 rounded-3xl border border-dashed border-line bg-card px-5 py-8 text-center text-sm leading-6 text-muted"
    >
      Nothing here yet. Write a note for any day and it will show up in this list.
    </p>

    <ul v-else class="mt-6 space-y-3">
      <li v-for="note in notes" :key="note.date">
        <RouterLink
          :to="note.date === todayKey() ? '/' : { path: '/', query: { date: note.date } }"
          class="block rounded-3xl border border-line bg-card px-4 py-4 transition hover:border-accent"
        >
          <div class="flex items-baseline justify-between gap-3">
            <p class="text-sm font-semibold text-accent">{{ formatShortDate(note.date) }}</p>
            <p class="text-xs text-muted">{{ entryCount(note) }}</p>
          </div>
          <p class="mt-1 text-sm leading-6 text-ink">{{ excerpt(note) }}</p>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

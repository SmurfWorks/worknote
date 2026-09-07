<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { listNotes } from '../lib/db'
import { formatShortDate } from '../lib/dates'

const notes = ref([])
const loading = ref(true)

onMounted(async () => {
  notes.value = await listNotes()
  loading.value = false
})

function excerpt(text) {
  const clean = text.trim() || 'No transcript yet.'
  return clean.length > 140 ? `${clean.slice(0, 137)}…` : clean
}
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-[0.22em] text-neon">Review</p>
    <h1 class="mt-1 font-display text-3xl text-ink">History</h1>
    <p class="mt-2 text-sm leading-6 text-muted">Every saved day on this device, newest first.</p>

    <p v-if="loading" class="mt-10 text-sm text-muted">Loading…</p>

    <p v-else-if="notes.length === 0" class="mt-10 rounded-3xl border border-dashed border-line bg-card px-5 py-8 text-center text-sm leading-6 text-muted">
      Nothing here yet. Record today’s note and it will show up in this list.
    </p>

    <ul v-else class="mt-6 space-y-3">
      <li v-for="note in notes" :key="note.date">
        <RouterLink
          :to="{ name: 'note', params: { date: note.date } }"
          class="block rounded-3xl border border-line bg-card px-4 py-4 transition hover:border-accent"
        >
          <p class="text-sm font-semibold text-neon">{{ formatShortDate(note.date) }}</p>
          <p class="mt-1 text-sm leading-6 text-ink">{{ excerpt(note.transcript) }}</p>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

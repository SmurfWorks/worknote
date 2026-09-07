<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { deleteNote, getNote, saveNote } from '../lib/db'
import { formatDisplayDate, isDateKey } from '../lib/dates'

const route = useRoute()
const router = useRouter()
const date = computed(() => String(route.params.date ?? ''))
const note = ref(null)
const loading = ref(true)
const missing = ref(false)
const confirmDelete = ref(false)
const audioUrl = ref(null)
let saveTimer = null

const heading = computed(() => (isDateKey(date.value) ? formatDisplayDate(date.value) : 'Note'))

function revokeUrl() {
  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
  audioUrl.value = null
}

async function load() {
  loading.value = true
  missing.value = false
  revokeUrl()
  if (!isDateKey(date.value)) {
    missing.value = true
    loading.value = false
    return
  }
  const stored = await getNote(date.value)
  if (!stored) {
    missing.value = true
    note.value = null
  } else {
    note.value = stored
    if (stored.audioBlob) audioUrl.value = URL.createObjectURL(stored.audioBlob)
  }
  loading.value = false
}

async function persist() {
  if (!note.value) return
  await saveNote({
    ...note.value,
    updatedAt: new Date().toISOString(),
  })
}

watch(
  () => note.value?.transcript,
  () => {
    if (!note.value) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      persist()
    }, 400)
  },
)

async function remove() {
  await deleteNote(date.value)
  confirmDelete.value = false
  await router.push('/history')
}

onMounted(() => {
  load()
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
  revokeUrl()
})
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-[0.22em] text-neon">Note</p>
    <h1 class="mt-1 font-display text-3xl leading-tight text-ink">{{ heading }}</h1>

    <p v-if="loading" class="mt-10 text-sm text-muted">Loading…</p>
    <p v-else-if="missing" class="mt-10 text-sm text-muted">That day does not have a saved note.</p>

    <article v-else-if="note" class="mt-6 rounded-3xl border border-line bg-card p-4">
      <audio v-if="audioUrl" class="w-full" :src="audioUrl" controls />
      <p v-else class="text-sm text-muted">This day was saved as text only.</p>

      <label class="mt-4 block text-sm font-medium text-muted" for="note-transcript">Transcript</label>
      <textarea
        id="note-transcript"
        v-model="note.transcript"
        rows="8"
        class="mt-2 w-full resize-y rounded-2xl border border-line bg-paper px-3 py-3 text-sm leading-6 text-ink outline-none focus:border-accent"
      />

      <button
        type="button"
        class="mt-4 text-sm font-semibold text-red-700"
        @click="confirmDelete = true"
      >
        Delete this day
      </button>
    </article>

    <ConfirmDialog
      :open="confirmDelete"
      title="Delete this note?"
      message="The audio and transcript for this day will be removed from this device."
      confirm-label="Delete"
      danger
      @cancel="confirmDelete = false"
      @confirm="remove"
    />
  </section>
</template>

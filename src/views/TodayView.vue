<script setup>
import { computed, onActivated, onDeactivated, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import RecordPanel from '../components/RecordPanel.vue'
import { deleteNote, getNote, noteHasContent, saveNote } from '../lib/db'
import {
  dateRelationLabel,
  formatDisplayDate,
  isDateKey,
  shiftDateKey,
  todayKey,
} from '../lib/dates'
import { shouldNudgeToday } from '../lib/reminders'

defineOptions({ name: 'TodayView' })

const route = useRoute()
const router = useRouter()
const note = ref(null)
const loading = ref(true)
const showRecorder = ref(true)
const showNudge = ref(false)
const confirmRerecord = ref(false)
const confirmDelete = ref(false)
const audioUrl = ref(null)
const saveError = ref(null)
const recording = ref(false)
let saveTimer = null

const date = computed(() => {
  const fromParams = String(route.params.date ?? '')
  const fromQuery = String(route.query.date ?? '')
  if (route.name === 'note') {
    return isDateKey(fromParams) ? fromParams : ''
  }
  if (isDateKey(fromQuery)) return fromQuery
  return todayKey()
})

const dateValid = computed(() => isDateKey(date.value))
const heading = computed(() => (dateValid.value ? formatDisplayDate(date.value) : 'Note'))
const eyebrow = computed(() => (dateValid.value ? dateRelationLabel(date.value) : 'Note'))
const isToday = computed(() => date.value === todayKey())
const hasNote = computed(() => noteHasContent(note.value))
const recordHint = computed(() =>
  isToday.value ? 'Tap to record today’s note' : 'Tap to record this day’s note',
)

function revokeUrl() {
  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
  audioUrl.value = null
}

function syncAudio(current) {
  revokeUrl()
  if (current?.audioBlob) {
    audioUrl.value = URL.createObjectURL(current.audioBlob)
  }
}

function goToDate(nextKey) {
  if (recording.value || !isDateKey(nextKey)) return
  persistTranscript()
  if (route.name === 'note') {
    router.replace({ name: 'note', params: { date: nextKey } })
    return
  }
  if (nextKey === todayKey()) {
    router.replace({ path: '/' })
    return
  }
  router.replace({ path: '/', query: { date: nextKey } })
}

function jumpToToday() {
  if (recording.value) return
  router.push({ path: '/' })
}

async function refresh() {
  if (!dateValid.value) {
    note.value = null
    showRecorder.value = false
    showNudge.value = false
    loading.value = false
    return
  }
  saveError.value = null
  confirmRerecord.value = false
  confirmDelete.value = false
  note.value = (await getNote(date.value)) ?? null
  showRecorder.value = !note.value
  showNudge.value = isToday.value && (await shouldNudgeToday())
  loading.value = false
}

async function persistTranscript() {
  if (!note.value) return
  await saveNote({
    ...note.value,
    transcript: note.value.transcript,
    updatedAt: new Date().toISOString(),
  })
}

function queuePersist() {
  if (!note.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    persistTranscript()
  }, 400)
}

async function onCaptured(payload) {
  recording.value = false
  saveError.value = null
  const now = new Date().toISOString()
  const next = {
    date: date.value,
    audioBlob: payload.blob,
    audioMimeType: payload.mimeType,
    transcript: payload.transcript,
    createdAt: note.value?.createdAt ?? now,
    updatedAt: now,
  }
  try {
    await saveNote(next)
    note.value = next
    showRecorder.value = false
    showNudge.value = false
  } catch {
    saveError.value = 'Could not save this note on your device. Try again.'
  }
}

function requestNewRecording() {
  if (hasNote.value) {
    confirmRerecord.value = true
    return
  }
  showRecorder.value = true
}

async function writeInstead() {
  const now = new Date().toISOString()
  const next = {
    date: date.value,
    audioBlob: note.value?.audioBlob ?? null,
    audioMimeType: note.value?.audioMimeType ?? null,
    transcript: note.value?.transcript ?? '',
    createdAt: note.value?.createdAt ?? now,
    updatedAt: now,
  }
  await saveNote(next)
  note.value = next
  showRecorder.value = false
  showNudge.value = false
}

async function remove() {
  await deleteNote(date.value)
  confirmDelete.value = false
  note.value = null
  revokeUrl()
  showRecorder.value = true
  showNudge.value = isToday.value && (await shouldNudgeToday())
}

watch(
  () => note.value?.transcript,
  () => {
    queuePersist()
  },
)

watch(
  () => note.value?.audioBlob,
  () => syncAudio(note.value),
)

watch(
  date,
  () => {
    loading.value = true
    refresh()
  },
  { immediate: true },
)

onActivated(() => {
  if (recording.value) return
  refresh()
})

onDeactivated(() => {
  persistTranscript()
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
  revokeUrl()
})
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-[0.22em] text-neon">{{ eyebrow }}</p>
    <h1 class="mt-1 font-display text-3xl leading-tight text-ink">{{ heading }}</h1>
    <p class="mt-2 text-sm leading-6 text-muted">
      A short voice note of what you worked on. Captions and audio stay on this device.
    </p>

    <div class="mt-4 flex items-center gap-2">
      <button
        type="button"
        class="inline-flex size-11 items-center justify-center rounded-full border border-line bg-card text-ink disabled:opacity-40"
        :disabled="recording || !dateValid"
        aria-label="Previous day"
        @click="goToDate(shiftDateKey(date, -1))"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" aria-hidden="true">
          <path
            d="M15 6 9 12l6 6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <label class="sr-only" for="note-date">Note date</label>
      <input
        id="note-date"
        :value="date"
        type="date"
        class="min-w-0 flex-1 rounded-2xl border border-line bg-card px-3 py-2.5 text-sm font-medium text-ink disabled:opacity-40"
        :disabled="recording"
        @change="goToDate($event.target.value)"
      />
      <button
        type="button"
        class="inline-flex size-11 items-center justify-center rounded-full border border-line bg-card text-ink disabled:opacity-40"
        :disabled="recording || !dateValid"
        aria-label="Next day"
        @click="goToDate(shiftDateKey(date, 1))"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" aria-hidden="true">
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
    <button
      v-if="!isToday"
      type="button"
      class="mt-2 text-sm font-semibold text-accent disabled:opacity-40"
        :disabled="recording"
        @click="jumpToToday"
    >
      Jump to today
    </button>

    <div
      v-if="showNudge && !hasNote"
      class="mt-4 rounded-2xl bg-neon-soft px-4 py-3 text-sm text-ink"
    >
      Reminder time has passed — capture today before you forget.
    </div>

    <div v-if="!dateValid" class="mt-10 text-sm text-muted">That date is not valid.</div>

    <div v-else-if="loading" class="mt-10 text-sm text-muted">Loading…</div>

    <div v-else class="mt-8">
      <div v-if="showRecorder">
        <RecordPanel
          :hint="recordHint"
          @captured="onCaptured"
          @recording="recording = $event"
        />
        <button
          type="button"
          class="mt-6 w-full text-center text-sm font-semibold text-muted"
          @click="writeInstead"
        >
          Type a note instead
        </button>
      </div>

      <article v-else class="rounded-3xl border border-line bg-card p-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-display text-xl text-ink">{{ isToday ? 'Today’s note' : 'This day’s note' }}</h2>
          <button
            type="button"
            class="text-sm font-semibold text-accent"
            @click="requestNewRecording"
          >
            Record again
          </button>
        </div>

        <audio v-if="audioUrl" class="mt-4 w-full" :src="audioUrl" controls />
        <p v-else class="mt-4 text-sm text-muted">No audio attached — you can still keep the written note.</p>

        <label class="mt-4 block text-sm font-medium text-muted" for="day-transcript">
          Transcript
        </label>
        <textarea
          id="day-transcript"
          v-if="note"
          v-model="note.transcript"
          rows="6"
          class="mt-2 w-full resize-y rounded-2xl border border-line bg-paper px-3 py-3 text-sm leading-6 text-ink outline-none focus:border-accent"
          placeholder="Edit the captions, or type what you worked on."
          @input="queuePersist"
          @blur="persistTranscript"
        />

        <button
          type="button"
          class="mt-4 text-sm font-semibold text-red-700"
          @click="confirmDelete = true"
        >
          Delete this day
        </button>
      </article>
    </div>

    <p v-if="saveError" class="mt-4 text-sm text-red-700">{{ saveError }}</p>

    <ConfirmDialog
      :open="confirmRerecord"
      title="Replace this note?"
      :message="`Recording again will replace the audio and captions saved for ${heading}.`"
      confirm-label="Replace"
      danger
      @cancel="confirmRerecord = false"
      @confirm="confirmRerecord = false; showRecorder = true"
    />

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

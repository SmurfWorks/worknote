<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import RecordPanel from '../components/RecordPanel.vue'
import { getNote, noteHasContent, saveNote } from '../lib/db'
import { formatDisplayDate, todayKey } from '../lib/dates'
import { shouldNudgeToday } from '../lib/reminders'

defineOptions({ name: 'TodayView' })

const date = todayKey()
const note = ref(null)
const loading = ref(true)
const showRecorder = ref(true)
const showNudge = ref(false)
const confirmRerecord = ref(false)
const audioUrl = ref(null)
const saveError = ref(null)

const heading = computed(() => formatDisplayDate(date))
const hasNote = computed(() => noteHasContent(note.value))

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

async function refresh() {
  note.value = (await getNote(date)) ?? null
  showRecorder.value = !noteHasContent(note.value)
  showNudge.value = await shouldNudgeToday()
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

async function onCaptured(payload) {
  saveError.value = null
  const now = new Date().toISOString()
  const next = {
    date,
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
    date,
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

watch(
  () => note.value?.audioBlob,
  () => syncAudio(note.value),
)

onMounted(() => {
  refresh()
})
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-[0.22em] text-neon">Today</p>
    <h1 class="mt-1 font-display text-3xl leading-tight text-ink">{{ heading }}</h1>
    <p class="mt-2 text-sm leading-6 text-muted">
      A short voice note of what you worked on. Captions and audio stay on this device.
    </p>

    <div
      v-if="showNudge && !hasNote"
      class="mt-4 rounded-2xl bg-neon-soft px-4 py-3 text-sm text-ink"
    >
      Reminder time has passed — capture today before you forget.
    </div>

    <div v-if="loading" class="mt-10 text-sm text-muted">Loading…</div>

    <div v-else class="mt-8">
      <div v-if="showRecorder">
        <RecordPanel @captured="onCaptured" />
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
          <h2 class="font-display text-xl text-ink">Today’s note</h2>
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

        <label class="mt-4 block text-sm font-medium text-muted" for="today-transcript">
          Transcript
        </label>
        <textarea
          id="today-transcript"
          v-if="note"
          v-model="note.transcript"
          rows="6"
          class="mt-2 w-full resize-y rounded-2xl border border-line bg-paper px-3 py-3 text-sm leading-6 text-ink outline-none focus:border-accent"
          placeholder="Edit the captions, or type what you worked on."
          @blur="persistTranscript"
        />
      </article>
    </div>

    <p v-if="saveError" class="mt-4 text-sm text-red-700">{{ saveError }}</p>

    <ConfirmDialog
      :open="confirmRerecord"
      title="Replace today’s note?"
      message="Recording again will replace the audio and captions saved for today."
      confirm-label="Replace"
      danger
      @cancel="confirmRerecord = false"
      @confirm="confirmRerecord = false; showRecorder = true"
    />
  </section>
</template>

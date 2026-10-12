<script setup>
import { computed, nextTick, onActivated, onDeactivated, onUnmounted, ref, watch } from 'vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { setDayLeaveHandler, useDayDate } from '../composables/useDayDate'
import { syncReminders } from '../composables/useReminders'
import { showToast } from '../composables/useToasts'
import { joinText, useTranscription } from '../composables/useTranscription'
import { deleteNote, getNote, noteHasContent, saveNote } from '../lib/db'
import { dateRelationLabel, formatDisplayDate } from '../lib/dates'
import { shouldNudgeToday } from '../lib/reminders'

defineOptions({ name: 'TodayView' })

const { date, dateValid, isToday, recording: dictating } = useDayDate()
const {
  isSupported: dictationSupported,
  liveText,
  error: dictationError,
  start: startDictation,
  stop: stopDictation,
} = useTranscription()

const note = ref(null)
const loading = ref(true)
const noteField = ref(null)
const showNudge = ref(false)
const confirmDelete = ref(false)
const saveError = ref(null)
/** The note's text when dictation started; what is heard is added after it. */
let dictationBase = ''
let saveTimer = null
let hydrating = false
let dirty = false

const heading = computed(() => (dateValid.value ? formatDisplayDate(date.value) : 'Note'))
const eyebrow = computed(() => (dateValid.value ? dateRelationLabel(date.value) : 'Note'))
const hasNote = computed(() => noteHasContent(note.value))

function blankNote() {
  const now = new Date().toISOString()
  return { date: date.value, transcript: '', createdAt: now, updatedAt: now }
}

async function refresh() {
  if (!dateValid.value) {
    note.value = null
    showNudge.value = false
    loading.value = false
    return
  }
  hydrating = true
  dirty = false
  saveError.value = null
  confirmDelete.value = false
  note.value = (await getNote(date.value)) ?? blankNote()
  showNudge.value = isToday.value && (await shouldNudgeToday())
  loading.value = false
  await nextTick()
  hydrating = false
}

async function persistNote({ announceSave = false } = {}) {
  if (!note.value) return
  let result
  try {
    result = await saveNote({ ...note.value, updatedAt: new Date().toISOString() })
  } catch {
    saveError.value = 'Could not save this note on your device. Try again.'
    return
  }
  saveError.value = null
  if (result === 'removed') {
    dirty = false
    showToast('Note removed', 'muted')
    syncReminders()
    return
  }
  if (result === 'saved' && announceSave && dirty) {
    dirty = false
    showNudge.value = false
    showToast('Note saved')
    syncReminders()
  }
}

function queuePersist() {
  if (!note.value || hydrating) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    persistNote()
  }, 400)
}

async function toggleDictation() {
  if (!note.value) return
  if (dictating.value) {
    const heard = await stopDictation()
    dictating.value = false
    note.value.transcript = joinText(dictationBase, heard)
    await persistNote({ announceSave: true })
    return
  }
  dictationBase = note.value.transcript
  dictating.value = true
  startDictation()
}

async function remove() {
  confirmDelete.value = false
  if (dictating.value) {
    await stopDictation()
    dictating.value = false
  }
  await deleteNote(date.value)
  hydrating = true
  note.value = blankNote()
  dirty = false
  showNudge.value = isToday.value && (await shouldNudgeToday())
  showToast('Note removed', 'muted')
  syncReminders()
  await nextTick()
  hydrating = false
}

// While dictating, the note shows what has been heard so far after the text that was already there.
watch(liveText, (heard) => {
  if (!dictating.value || !note.value) return
  note.value.transcript = joinText(dictationBase, heard)
})

watch(
  () => note.value?.transcript,
  () => {
    if (hydrating || !note.value) return
    dirty = true
    queuePersist()
  },
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
  setDayLeaveHandler(() => persistNote({ announceSave: true }))
  refresh()
})

onDeactivated(async () => {
  setDayLeaveHandler(null)
  if (dictating.value) {
    const heard = await stopDictation()
    dictating.value = false
    if (note.value) note.value.transcript = joinText(dictationBase, heard)
  }
  persistNote({ announceSave: true })
})

onUnmounted(() => {
  setDayLeaveHandler(null)
  if (saveTimer) clearTimeout(saveTimer)
  if (dictating.value) {
    stopDictation()
    dictating.value = false
  }
})
</script>

<template>
  <section>
    <p class="text-sm font-bold uppercase tracking-[0.14em] text-accent">{{ eyebrow }}</p>
    <h1 class="mt-1 font-display text-3xl leading-tight text-ink">{{ heading }}</h1>

    <div
      v-if="showNudge && !hasNote"
      class="mt-4 rounded-2xl bg-neon-soft px-4 py-3 text-sm text-ink"
    >
      Reminder time has passed — capture today before you forget.
    </div>

    <div v-if="!dateValid" class="mt-10 text-sm text-muted">That date is not valid.</div>

    <div v-else-if="loading" class="mt-10 text-sm text-muted">Loading…</div>

    <div v-else-if="note" class="mt-6">
      <article class="rounded-3xl border border-line bg-card p-4">
        <div class="flex items-center justify-between gap-3">
          <label for="day-note" class="font-display text-xl text-ink">
            What did you work on?
          </label>
          <button
            v-if="dictationSupported"
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95"
            :class="dictating ? 'bg-neon text-on-neon' : 'bg-accent text-on-accent'"
            :aria-pressed="dictating"
            @click="toggleDictation"
          >
            <span v-if="dictating" class="size-2.5 animate-pulse rounded-full bg-on-neon" aria-hidden="true" />
            <svg v-else viewBox="0 0 24 24" class="size-4" fill="none" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
              <path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            {{ dictating ? 'Stop' : 'Dictate' }}
          </button>
        </div>

        <textarea
          id="day-note"
          ref="noteField"
          v-model="note.transcript"
          rows="8"
          :readonly="dictating"
          class="mt-3 w-full resize-y rounded-2xl border border-line bg-paper px-3 py-3 text-base leading-6 text-ink outline-none focus:border-accent"
          :class="dictating ? 'border-neon' : ''"
          :placeholder="dictating ? 'Listening…' : 'Type what you worked on, or tap Dictate and say it.'"
          @blur="persistNote({ announceSave: true })"
        />

        <p v-if="dictating" class="mt-2 text-sm text-muted">Listening… tap Stop when you’re done.</p>
        <p v-if="dictationError" class="mt-2 text-sm text-muted">{{ dictationError }}</p>

      </article>

      <button
        v-if="hasNote"
        type="button"
        class="mt-4 w-full rounded-full border border-line bg-card px-4 py-2.5 text-sm font-semibold text-warn"
        @click="confirmDelete = true"
      >
        Delete this note
      </button>
    </div>

    <p v-if="saveError" class="mt-4 text-sm text-warn">{{ saveError }}</p>

    <ConfirmDialog
      :open="confirmDelete"
      title="Delete this note?"
      message="The note for this day will be removed from this device."
      confirm-label="Delete"
      danger
      @cancel="confirmDelete = false"
      @confirm="remove"
    />

  </section>
</template>

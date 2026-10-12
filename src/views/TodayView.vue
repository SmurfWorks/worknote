<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { setDayLeaveHandler, useDayDate } from '../composables/useDayDate'
import { syncReminders } from '../composables/useReminders'
import { showToast } from '../composables/useToasts'
import { joinText, useTranscription } from '../composables/useTranscription'
import { createEntry, getNote, saveNote } from '../lib/db'
import { dateRelationLabel, formatDisplayDate, formatTime } from '../lib/dates'
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

const day = ref(null)
const draft = ref('')
const loading = ref(true)
const showNudge = ref(false)
/** The entry waiting on the delete confirmation. */
const entryToDelete = ref(null)
const saveError = ref(null)
/** The draft's text when dictation started; what is heard is added after it. */
let dictationBase = ''
let saveTimer = null
let hydrating = false

const heading = computed(() => (dateValid.value ? formatDisplayDate(date.value) : 'Note'))
const eyebrow = computed(() => (dateValid.value ? dateRelationLabel(date.value) : 'Note'))
/** Newest first, under the box for a new entry. */
const entries = computed(() =>
  [...(day.value?.entries ?? [])].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))),
)

function entryTime(entry) {
  return entry.createdAt ? formatTime(new Date(entry.createdAt)) : ''
}

async function refresh() {
  if (!dateValid.value) {
    day.value = null
    showNudge.value = false
    loading.value = false
    return
  }
  hydrating = true
  saveError.value = null
  entryToDelete.value = null
  draft.value = ''
  day.value = (await getNote(date.value)) ?? { date: date.value, entries: [] }
  showNudge.value = isToday.value && (await shouldNudgeToday())
  loading.value = false
  await nextTick()
  hydrating = false
}

async function persistDay() {
  if (!day.value) return null
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  try {
    const result = await saveNote(day.value)
    saveError.value = null
    return result
  } catch {
    saveError.value = 'Could not save this note on your device. Try again.'
    return null
  }
}

function queuePersist() {
  if (!day.value || hydrating) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(persistDay, 400)
}

async function finishDictation() {
  if (!dictating.value) return
  const heard = await stopDictation()
  dictating.value = false
  draft.value = joinText(dictationBase, heard)
}

async function toggleDictation() {
  if (dictating.value) {
    await finishDictation()
    return
  }
  dictationBase = draft.value
  dictating.value = true
  startDictation()
}

/** Saves the box as a new entry for this day. */
async function addEntry({ quiet = false } = {}) {
  // Without dictation the save starts straight away, so leaving the screen cannot outrun it.
  if (dictating.value) await finishDictation()
  const text = draft.value.trim()
  if (!text || !day.value) return
  day.value.entries.push(createEntry(text))
  draft.value = ''
  const result = await persistDay()
  if (result !== 'saved') return
  showNudge.value = false
  if (!quiet) showToast('Entry added')
  syncReminders()
}

async function confirmDeleteEntry() {
  const entry = entryToDelete.value
  entryToDelete.value = null
  if (!entry || !day.value) return
  day.value.entries = day.value.entries.filter((item) => item.id !== entry.id)
  const result = await persistDay()
  showToast('Entry deleted', 'muted')
  if (result === 'removed') {
    showNudge.value = isToday.value && (await shouldNudgeToday())
    syncReminders()
  }
}

function editedEntry(entry) {
  entry.updatedAt = new Date().toISOString()
  queuePersist()
}

/** Leaving the day keeps anything typed or dictated but not yet added. */
async function saveBeforeLeaving() {
  await addEntry({ quiet: true })
  await persistDay()
}

// While dictating, the box shows what has been heard so far after the text that was already there.
watch(liveText, (heard) => {
  if (dictating.value) draft.value = joinText(dictationBase, heard)
})

watch(
  date,
  () => {
    loading.value = true
    refresh()
  },
  { immediate: true },
)

onMounted(() => {
  setDayLeaveHandler(saveBeforeLeaving)
})

// Switching tabs unmounts this view, so a draft or dictation in progress is saved as an entry first.
onBeforeUnmount(() => {
  setDayLeaveHandler(null)
  saveBeforeLeaving()
})
</script>

<template>
  <section>
    <p class="text-sm font-bold uppercase tracking-[0.14em] text-accent">{{ eyebrow }}</p>
    <h1 class="mt-1 font-display text-3xl leading-tight text-ink">{{ heading }}</h1>

    <div
      v-if="showNudge"
      class="mt-4 rounded-2xl bg-neon-soft px-4 py-3 text-sm text-ink"
    >
      Reminder time has passed — add an entry for what you’ve done since.
    </div>

    <div v-if="!dateValid" class="mt-10 text-sm text-muted">That date is not valid.</div>

    <div v-else-if="loading" class="mt-10 text-sm text-muted">Loading…</div>

    <div v-else-if="day" class="mt-6">
      <form class="rounded-3xl border border-line bg-card p-4" @submit.prevent="addEntry()">
        <div class="flex items-center justify-between gap-3">
          <label for="new-entry" class="font-display text-xl text-ink">What did you work on?</label>
          <button
            v-if="dictationSupported"
            type="button"
            class="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95"
            :class="dictating ? 'bg-neon text-on-neon' : 'bg-accent-soft text-accent'"
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
          id="new-entry"
          v-model="draft"
          rows="4"
          :readonly="dictating"
          class="mt-3 w-full resize-y rounded-2xl border border-line bg-paper px-3 py-3 text-base leading-6 text-ink outline-none focus:border-accent"
          :class="dictating ? 'border-neon' : ''"
          :placeholder="dictating ? 'Listening…' : 'Type an entry, or tap Dictate and say it.'"
        />

        <p v-if="dictating" class="mt-2 text-sm text-muted">Listening… tap Stop when you’re done.</p>
        <p v-if="dictationError" class="mt-2 text-sm text-muted">{{ dictationError }}</p>

        <button
          type="submit"
          class="mt-3 w-full rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-on-accent disabled:opacity-40"
          :disabled="!draft.trim() && !dictating"
        >
          Add entry
        </button>
      </form>

      <h2 v-if="entries.length" class="mt-6 text-sm font-bold uppercase tracking-[0.14em] text-muted">
        {{ entries.length === 1 ? '1 entry' : `${entries.length} entries` }}
      </h2>
      <p v-else class="mt-6 text-center text-sm text-muted">No entries for this day yet.</p>

      <ul class="mt-3 space-y-3">
        <li v-for="entry in entries" :key="entry.id" class="rounded-3xl border border-line bg-card p-4">
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm font-semibold text-accent">{{ entryTime(entry) }}</span>
            <button
              type="button"
              class="flex size-9 items-center justify-center rounded-full text-xl leading-none text-muted"
              :aria-label="`Delete the ${entryTime(entry) || 'earlier'} entry`"
              @click="entryToDelete = entry"
            >
              ×
            </button>
          </div>
          <textarea
            v-model="entry.text"
            rows="3"
            aria-label="Entry"
            class="mt-1 w-full resize-y rounded-2xl border border-transparent bg-transparent px-0 py-1 text-base leading-6 text-ink outline-none [field-sizing:content] focus:border-line focus:bg-paper focus:px-3"
            @input="editedEntry(entry)"
            @blur="persistDay"
          />
        </li>
      </ul>
    </div>

    <p v-if="saveError" class="mt-4 text-sm text-warn">{{ saveError }}</p>

    <ConfirmDialog
      :open="Boolean(entryToDelete)"
      title="Delete this entry?"
      message="This entry will be removed from this device."
      confirm-label="Delete"
      danger
      @cancel="entryToDelete = null"
      @confirm="confirmDeleteEntry"
    />
  </section>
</template>

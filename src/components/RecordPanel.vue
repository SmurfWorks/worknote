<script setup>
import { formatDuration } from '../lib/dates'
import { useRecorder } from '../composables/useRecorder'
import { useTranscription } from '../composables/useTranscription'

defineProps({
  hint: { type: String, default: 'Tap to record this day’s note' },
})

const emit = defineEmits(['captured', 'recording'])

const { isRecording, elapsedSeconds, error: recordError, levels, prepare, start, stop } =
  useRecorder()
const {
  liveText,
  error: transcriptError,
  start: startTranscript,
  stop: stopTranscript,
} = useTranscription()

async function toggle() {
  if (isRecording.value) {
    emit('recording', false)
    const transcript = stopTranscript()
    const result = await stop()
    if (!result) return
    emit('captured', {
      blob: result.blob,
      mimeType: result.mimeType,
      transcript,
    })
    return
  }

  startTranscript()
  prepare()
  try {
    await start()
  } catch {
    stopTranscript()
    emit('recording', false)
    return
  }
  emit('recording', true)
}
</script>

<template>
  <div class="flex flex-col items-center">
    <p
      class="font-display text-3xl tabular-nums tracking-wide"
      :class="isRecording ? 'text-neon' : 'text-ink'"
    >
      {{ isRecording ? formatDuration(elapsedSeconds) : '00:00' }}
    </p>

    <div class="mt-4 flex h-12 items-end justify-center gap-1">
      <span
        v-for="(level, index) in levels"
        :key="index"
        class="w-1.5 rounded-full transition-[height] duration-75"
        :class="isRecording ? 'bg-neon opacity-100' : 'bg-accent opacity-30'"
        :style="{ height: `${8 + level * 40}px` }"
      />
    </div>

    <button
      type="button"
      class="mt-6 flex size-24 items-center justify-center rounded-full transition active:scale-95"
      :class="isRecording ? 'bg-neon text-on-neon glow-neon' : 'bg-accent text-on-accent glow-accent'"
      :aria-pressed="isRecording"
      :aria-label="isRecording ? 'Stop recording' : 'Start recording'"
      @click="toggle"
    >
      <span v-if="isRecording" class="size-8 rounded-md bg-on-accent" />
      <svg v-else viewBox="0 0 24 24" class="size-10" fill="none" aria-hidden="true">
        <rect x="9" y="4" width="6" height="10" rx="3" fill="currentColor" />
        <path
          d="M6.5 11a5.5 5.5 0 0 0 11 0"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <path d="M12 16.5V20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>

    <p class="mt-3 text-sm font-medium text-muted">
      {{ isRecording ? 'Listening… tap to save' : hint }}
    </p>

    <p v-if="liveText || isRecording" class="mt-4 w-full rounded-2xl bg-card px-4 py-3 text-sm leading-6 text-ink">
      {{ liveText || 'Captions will appear here.' }}
    </p>

    <p v-if="recordError" class="mt-3 text-center text-sm text-red-700">{{ recordError }}</p>
    <p v-else-if="transcriptError" class="mt-3 text-center text-sm text-muted">
      {{ transcriptError }}
    </p>
  </div>
</template>

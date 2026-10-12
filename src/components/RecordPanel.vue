<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { formatDuration } from '../lib/dates'
import { isAndroid } from '../lib/device'
import { useRecorder } from '../composables/useRecorder'
import { useTranscription } from '../composables/useTranscription'

defineProps({
  hint: { type: String, default: 'Tap to record this day’s note' },
})

const emit = defineEmits(['captured', 'recording'])

const {
  isRecording,
  elapsedSeconds,
  error: recordError,
  levels,
  prepare,
  start,
  stop,
} = useRecorder()
const {
  isSupported: captionsSupported,
  liveText,
  error: transcriptError,
  start: startTranscript,
  stop: stopTranscript,
} = useTranscription()

// Android cannot give the microphone to captions and an audio recording at once, so there the
// note is the captions alone, with no audio kept.
const captionsOnly = isAndroid() && captionsSupported.value
const captioning = ref(false)
const captionSeconds = ref(0)
let captionTimer = 0

const active = computed(() => (captionsOnly ? captioning.value : isRecording.value))
const seconds = computed(() => (captionsOnly ? captionSeconds.value : elapsedSeconds.value))

function stopCaptionTimer() {
  if (captionTimer) window.clearInterval(captionTimer)
  captionTimer = 0
}

async function toggleCaptionsOnly() {
  if (captioning.value) {
    captioning.value = false
    stopCaptionTimer()
    emit('recording', false)
    const transcript = await stopTranscript()
    emit('captured', { blob: null, mimeType: null, transcript })
    return
  }
  captionSeconds.value = 0
  startTranscript()
  captioning.value = true
  captionTimer = window.setInterval(() => {
    captionSeconds.value += 1
  }, 1000)
  emit('recording', true)
}

async function toggle() {
  if (captionsOnly) {
    await toggleCaptionsOnly()
    return
  }

  if (isRecording.value) {
    emit('recording', false)
    // Both stop together, so the recording ends when tapped while captions wait for their last words.
    const [transcript, result] = await Promise.all([stopTranscript(), stop()])
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
    await stopTranscript()
    emit('recording', false)
    return
  }
  emit('recording', true)
}

onUnmounted(() => {
  stopCaptionTimer()
  if (captioning.value) stopTranscript()
})
</script>

<template>
  <div class="flex flex-col items-center">
    <p
      class="font-display text-3xl tabular-nums tracking-wide"
      :class="active ? 'text-neon' : 'text-ink'"
    >
      {{ active ? formatDuration(seconds) : '00:00' }}
    </p>

    <div class="mt-4 flex h-12 items-end justify-center gap-1">
      <span
        v-for="(level, index) in levels"
        :key="index"
        class="w-1.5 rounded-full transition-[height] duration-75"
        :class="active ? 'bg-neon opacity-100' : 'bg-accent opacity-30'"
        :style="{ height: `${8 + level * 40}px` }"
      />
    </div>

    <button
      type="button"
      class="mt-6 flex size-24 items-center justify-center rounded-full transition active:scale-95"
      :class="active ? 'bg-neon text-on-neon glow-neon' : 'bg-accent text-on-accent glow-accent'"
      :aria-pressed="active"
      :aria-label="active ? 'Stop recording' : 'Start recording'"
      @click="toggle"
    >
      <span v-if="active" class="size-8 rounded-md bg-on-neon" />
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
      {{ active ? 'Listening… tap to save' : hint }}
    </p>

    <p v-if="captionsOnly && !active" class="mt-1 text-center text-xs text-muted">
      On Android, Worknote keeps the words you say, not the audio.
    </p>

    <p v-if="liveText || active" class="mt-4 w-full rounded-2xl bg-card px-4 py-3 text-sm leading-6 text-ink">
      {{ liveText || 'Captions will appear here.' }}
    </p>

    <p v-if="recordError" class="mt-3 text-center text-sm text-warn">{{ recordError }}</p>
    <p v-else-if="transcriptError" class="mt-3 text-center text-sm text-muted">
      {{ transcriptError }}
    </p>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useOnboarding } from '../composables/useOnboarding'

const { open, dismiss } = useOnboarding()
const startButton = ref(null)
const splashRoot = ref(null)
let previousOverflow = ''

function lockScroll(locked) {
  if (typeof document === 'undefined') return
  if (locked) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return
  }
  document.body.style.overflow = previousOverflow
}

watch(
  open,
  async (value) => {
    lockScroll(value)
    if (!value) return
    await nextTick()
    splashRoot.value?.scrollTo({ top: 0 })
    startButton.value?.focus({ preventScroll: true })
  },
  { immediate: true },
)

onBeforeUnmount(() => lockScroll(false))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="splashRoot"
      class="fixed inset-0 z-50 flex flex-col overflow-hidden bg-paper"
      role="dialog"
      aria-modal="true"
      aria-labelledby="splash-title"
    >
      <div
        class="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))]"
      >
        <div class="min-h-0 flex-1 overflow-y-auto pb-4">
          <p class="text-sm font-semibold uppercase tracking-[0.22em] text-neon">Welcome</p>
          <h1 id="splash-title" class="mt-1 font-display text-4xl leading-tight text-ink">Worknote</h1>
          <p class="mt-3 text-base leading-7 text-muted">
            A private daily log of what you worked on. Record a short voice note, or type it if you
            prefer.
          </p>

          <ul class="mt-8 space-y-3">
            <li class="rounded-3xl border border-line bg-card p-4">
              <p class="font-display text-lg text-ink">Capture the day</p>
              <p class="mt-1 text-sm leading-6 text-muted">
                Tap the mic to record. Captions appear as you speak, and you can edit them afterwards.
                Prefer typing? Use Type a note instead.
              </p>
            </li>
            <li class="rounded-3xl border border-line bg-card p-4">
              <p class="font-display text-lg text-ink">Any day, not just today</p>
              <p class="mt-1 text-sm leading-6 text-muted">
                The date bar at the bottom jumps to yesterday, tomorrow, or any date. History keeps
                every note you save.
              </p>
            </li>
            <li class="rounded-3xl border border-line bg-card p-4">
              <p class="font-display text-lg text-ink">Stays on this device</p>
              <p class="mt-1 text-sm leading-6 text-muted">
                Audio and transcripts live in this browser, not on a server. Optional reminders can
                nudge you on weekdays.
              </p>
            </li>
          </ul>
        </div>

        <button
          type="button"
          ref="startButton"
          class="mt-2 mb-[max(1.5rem,env(safe-area-inset-bottom))] w-full shrink-0 rounded-full bg-accent px-4 py-3 text-sm font-bold text-on-accent"
          @click="dismiss"
        >
          Get started
        </button>
      </div>
    </div>
  </Teleport>
</template>

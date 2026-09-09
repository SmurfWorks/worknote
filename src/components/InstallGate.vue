<script setup>
import { computed } from 'vue'
import { useInstallPrompt } from '../composables/useInstallPrompt'

const { canInstall, showInstalled, installing, isIos, isAndroid, install } = useInstallPrompt()

const how = computed(() => {
  if (isIos) {
    return 'On iPhone, tap Share, then Add to Home Screen. Open Worknote from the new icon next time.'
  }
  if (canInstall.value) {
    return 'After it installs, leave this page and open Worknote from your Home Screen.'
  }
  if (isAndroid) {
    return 'Use the browser menu to Add to Home Screen or Install app, then open Worknote from the icon.'
  }
  return 'In Chrome or Edge, use Install app from the address bar or the browser menu, then open Worknote from the installed app.'
})
</script>

<template>
  <section
    class="mx-auto flex h-full max-h-full max-w-lg flex-col overflow-hidden bg-paper px-5 pt-[max(1.5rem,env(safe-area-inset-top))]"
    :aria-labelledby="installing ? 'installing-title' : showInstalled ? 'install-title' : 'splash-title'"
  >
    <div v-if="installing" class="min-h-0 flex-1 overflow-y-auto pb-4">
      <p class="text-sm font-semibold uppercase tracking-[0.22em] text-neon">Installing</p>
      <h1 id="installing-title" class="mt-1 font-display text-4xl leading-tight text-ink">
        Adding Worknote
      </h1>
      <p class="mt-3 text-base leading-7 text-muted">
        Wait until Worknote finishes installing. This page will update when the Home Screen app is
        ready.
      </p>
    </div>

    <div v-else-if="showInstalled" class="min-h-0 flex-1 overflow-y-auto pb-4">
      <p class="text-sm font-semibold uppercase tracking-[0.22em] text-neon">Ready</p>
      <h1 id="install-title" class="mt-1 font-display text-4xl leading-tight text-ink">
        Worknote is installed
      </h1>
      <p class="mt-3 text-base leading-7 text-muted">
        Open it from the Home Screen icon to record notes and get reminders. This browser page is
        only for installing the app.
      </p>
    </div>

    <div v-else class="min-h-0 flex-1 overflow-y-auto pb-4">
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
          <p class="font-display text-lg text-ink">Stays on this device</p>
          <p class="mt-1 text-sm leading-6 text-muted">
            Audio and transcripts live in this browser, not on a server. Optional reminders can
            nudge you on weekdays.
          </p>
        </li>
        <li class="rounded-3xl border border-line bg-card p-4">
          <p class="font-display text-lg text-ink">Install to your Home Screen</p>
          <p class="mt-1 text-sm leading-6 text-muted">
            Worknote only runs as an app on your Home Screen. Notes and reminders are not available
            in this browser tab — add it, then open it from the icon.
          </p>
        </li>
      </ul>

      <p class="mt-6 rounded-3xl border border-line bg-card p-4 text-sm leading-6 text-muted">
        {{ how }}
      </p>
    </div>

    <button
      v-if="canInstall && !showInstalled"
      type="button"
      class="mb-[max(1.5rem,env(safe-area-inset-bottom))] w-full shrink-0 rounded-full bg-accent px-4 py-3 text-sm font-bold text-on-accent"
      @click="install"
    >
      Add to Home Screen
    </button>
    <p
      v-else
      class="mb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm leading-6 text-muted"
    >
      {{
        installing
          ? 'Keep this tab open until install finishes.'
          : showInstalled
            ? 'You can close this tab.'
            : 'Add Worknote, then open it from your Home Screen.'
      }}
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useInstallPrompt } from '../composables/useInstallPrompt'

const { canInstall, showInstalled, isIos, isAndroid, install } = useInstallPrompt()

const title = computed(() =>
  showInstalled.value ? 'Worknote is installed' : 'Add Worknote to your Home Screen',
)

const body = computed(() => {
  if (showInstalled.value) {
    return 'Open it from the Home Screen icon to record notes and get reminders. This browser page is only for installing the app.'
  }
  return 'Worknote is a Home Screen app. Install it, then open it from there — notes and reminders are not available in the browser.'
})

const how = computed(() => {
  if (showInstalled.value) return ''
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
    aria-labelledby="install-title"
  >
    <div class="min-h-0 flex-1 overflow-y-auto pb-4">
      <p class="text-sm font-semibold uppercase tracking-[0.22em] text-neon">
        {{ showInstalled ? 'Ready' : 'Install' }}
      </p>
      <h1 id="install-title" class="mt-1 font-display text-4xl leading-tight text-ink">
        {{ title }}
      </h1>
      <p class="mt-3 text-base leading-7 text-muted">{{ body }}</p>
      <p v-if="how" class="mt-6 rounded-3xl border border-line bg-card p-4 text-sm leading-6 text-muted">
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
        showInstalled
          ? 'You can close this tab.'
          : 'Come back here only if you still need the install steps.'
      }}
    </p>
  </section>
</template>

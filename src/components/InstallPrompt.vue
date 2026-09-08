<script setup>
import { computed, ref, watch } from 'vue'
import { useInstallPrompt } from '../composables/useInstallPrompt'
import { useOnboarding } from '../composables/useOnboarding'

const { open: onboardingOpen } = useOnboarding()
const { showPrompt, canInstall, isIos, install, dismiss } = useInstallPrompt()
const settled = ref(false)
const showHelp = ref(false)

watch(
  onboardingOpen,
  (open) => {
    if (open) {
      settled.value = false
      return
    }
    window.setTimeout(() => {
      settled.value = true
    }, 700)
  },
  { immediate: true },
)

const visible = computed(() => showPrompt.value && settled.value && !onboardingOpen.value)

const title = computed(() =>
  isIos ? 'Add Worknote to your Home Screen' : 'Install Worknote on this device',
)

const body = computed(() => {
  if (showHelp.value && isIos) {
    return 'Tap the Share button, then Add to Home Screen. Open it from there next time for a full-screen app and more reliable reminders.'
  }
  if (showHelp.value) {
    return 'Open the browser menu and tap Add to Home Screen or Install app. That gives you a home-screen icon and more reliable weekday reminders.'
  }
  return 'A home-screen icon opens it faster, and weekday reminders are more reliable from the installed app.'
})

async function onPrimary() {
  if (canInstall.value) {
    await install()
    return
  }
  showHelp.value = true
}
</script>

<template>
  <section
    v-if="visible"
    class="mb-4 rounded-3xl border border-line bg-card p-4"
    aria-label="Install Worknote"
  >
    <p class="font-display text-lg text-ink">{{ title }}</p>
    <p class="mt-1 text-sm leading-6 text-muted">{{ body }}</p>
    <div class="mt-4 flex flex-col gap-2 sm:flex-row">
      <button
        v-if="!showHelp"
        type="button"
        class="rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-on-accent"
        @click="onPrimary"
      >
        {{ canInstall ? 'Add to Home Screen' : 'How to add' }}
      </button>
      <button
        type="button"
        class="rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink"
        @click="dismiss"
      >
        {{ showHelp ? 'Got it' : 'Not now' }}
      </button>
    </div>
  </section>
</template>

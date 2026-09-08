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

const title = computed(() => (isIos ? 'Add to Home Screen' : 'Install Worknote'))

const help = computed(() =>
  isIos
    ? 'Share, then Add to Home Screen.'
    : 'Menu → Add to Home Screen',
)

async function onPrimary() {
  if (canInstall.value) {
    await install()
    return
  }
  showHelp.value = true
}
</script>

<template>
  <aside
    v-if="visible"
    class="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-3 pt-2"
    aria-label="Install Worknote"
  >
    <div
      class="pointer-events-auto flex max-w-full items-center gap-1 rounded-full border border-line bg-card/95 py-1 pl-3 pr-1 shadow-xl backdrop-blur"
    >
      <p class="min-w-0 text-xs font-semibold leading-tight text-ink">
        {{ showHelp ? help : title }}
      </p>
      <button
        v-if="!showHelp"
        type="button"
        class="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-on-accent"
        @click="onPrimary"
      >
        {{ canInstall ? 'Add' : 'How' }}
      </button>
      <button
        type="button"
        class="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-paper"
        :aria-label="showHelp ? 'Got it' : 'Not now'"
        @click="dismiss"
      >
        <svg viewBox="0 0 24 24" class="size-3.5" fill="none" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6 6 18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  </aside>
</template>

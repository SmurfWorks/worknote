<script setup>
import { onMounted, ref } from 'vue'
import { useInstallPrompt } from '../composables/useInstallPrompt'
import { useOnboarding } from '../composables/useOnboarding'
import { useReminders } from '../composables/useReminders'
import { getSettings, saveSettings } from '../lib/db'
import { WEEKDAYS } from '../lib/types'

const settings = ref(null)
const savedFlash = ref(false)
const { permission, requestPermission, refreshSchedule } = useReminders()
const { canInstall, isStandalone, install } = useInstallPrompt()
const { show: showOnboarding } = useOnboarding()

async function persist() {
  if (!settings.value) return
  await saveSettings(settings.value)
  await refreshSchedule()
  savedFlash.value = true
  window.setTimeout(() => {
    savedFlash.value = false
  }, 1200)
}

function toggleDay(day) {
  if (!settings.value) return
  const has = settings.value.days.includes(day)
  settings.value.days = has
    ? settings.value.days.filter((value) => value !== day)
    : [...settings.value.days, day].sort((a, b) => {
        const order = [1, 2, 3, 4, 5, 6, 0]
        return order.indexOf(a) - order.indexOf(b)
      })
  persist()
}

async function enableNotifications() {
  await requestPermission()
  await persist()
}

const permissionLabel = {
  granted: 'Allowed',
  denied: 'Blocked in the browser',
  default: 'Not asked yet',
}

onMounted(async () => {
  settings.value = await getSettings()
})
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-[0.22em] text-neon">Preferences</p>
    <h1 class="mt-1 font-display text-3xl text-ink">Settings</h1>
    <p class="mt-2 text-sm leading-6 text-muted">
      Choose when Worknote should nudge you. Notes never leave this device.
    </p>

    <p v-if="savedFlash" class="mt-3 text-sm font-medium text-neon">Saved</p>

    <div v-if="settings" class="mt-6 space-y-4">
      <section class="rounded-3xl border border-line bg-card p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="font-display text-xl text-ink">Reminders</h2>
            <p class="mt-1 text-sm text-muted">A notification on the days and time you pick.</p>
          </div>
          <label class="inline-flex cursor-pointer items-center">
            <span class="sr-only">Enable reminders</span>
            <input
              v-model="settings.remindersEnabled"
              type="checkbox"
              class="size-5 accent-accent"
              @change="persist"
            />
          </label>
        </div>

        <p class="mt-4 text-sm font-medium text-ink">Days</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="day in WEEKDAYS"
            :key="day.value"
            type="button"
            class="rounded-full px-3 py-1.5 text-sm font-semibold"
            :class="
              settings.days.includes(day.value)
                ? 'bg-accent text-on-accent'
                : 'bg-paper text-muted'
            "
            :aria-pressed="settings.days.includes(day.value)"
            @click="toggleDay(day.value)"
          >
            {{ day.label }}
          </button>
        </div>

        <label class="mt-4 block text-sm font-medium text-ink" for="reminder-time">Time</label>
        <input
          id="reminder-time"
          v-model="settings.time"
          type="time"
          class="mt-2 rounded-2xl border border-line bg-paper px-3 py-2 text-ink"
          @input="persist"
          @change="persist"
        />
      </section>

      <section class="rounded-3xl border border-line bg-card p-4">
        <h2 class="font-display text-xl text-ink">Notifications</h2>
        <p class="mt-1 text-sm leading-6 text-muted">
          Status: {{ permissionLabel[permission] }}. Install Worknote on your home screen for more
          reliable weekday nudges. iPhone can still miss scheduled web notifications unless the app
          is opened that day.
        </p>
        <button
          v-if="permission !== 'granted'"
          type="button"
          class="mt-4 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent"
          @click="enableNotifications"
        >
          Allow notifications
        </button>
        <button
          v-if="canInstall"
          type="button"
          class="mt-3 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink"
          @click="install"
        >
          Install on this device
        </button>
        <p v-else-if="isStandalone" class="mt-3 text-sm text-muted">Running as an installed app.</p>
      </section>

      <section class="rounded-3xl border border-line bg-card p-4">
        <h2 class="font-display text-xl text-ink">On this device</h2>
        <p class="mt-1 text-sm leading-6 text-muted">
          Audio and transcripts are stored in this browser’s local database. Live captions use the
          browser’s free speech service when it is available; you can always edit or type the note.
        </p>
        <button
          type="button"
          class="mt-4 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink"
          @click="showOnboarding"
        >
          How Worknote works
        </button>
      </section>
    </div>
  </section>
</template>

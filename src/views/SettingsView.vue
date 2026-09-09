<script setup>
import { onMounted, ref } from 'vue'
import { useOnboarding } from '../composables/useOnboarding'
import { useReminders } from '../composables/useReminders'
import { showToast } from '../composables/useToasts'
import { getSettings, saveSettings } from '../lib/db'
import { sendTestNotification } from '../lib/reminders'
import { normalizeTime, reminderTimes, WEEKDAYS } from '../lib/types'

const settings = ref(null)
const MAX_TIMES = 8
const { permission, backgroundReady, requestPermission, refreshSchedule } = useReminders()
const { show: showOnboarding } = useOnboarding()

async function persist() {
  if (!settings.value) return
  const times = reminderTimes({ times: settings.value.times })
  settings.value.times = times
  settings.value.time = times[0]
  settings.value.lastReminderCheckAt = new Date().toISOString()
  await saveSettings(settings.value)
  showToast('Saved')
  await refreshSchedule()
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

function updateTime(index, value) {
  if (!settings.value) return
  const next = normalizeTime(value)
  if (!next) return
  const times = [...settings.value.times]
  times[index] = next
  settings.value.times = reminderTimes({ times })
  settings.value.time = settings.value.times[0]
  persist()
}

function addTime() {
  if (!settings.value || settings.value.times.length >= MAX_TIMES) return
  const existing = new Set(settings.value.times)
  let hours = 12
  let minutes = 0
  if (settings.value.times.length) {
    const [lastHours, lastMinutes] = settings.value.times.at(-1).split(':').map(Number)
    minutes = lastMinutes
    hours = (lastHours + 1) % 24
  }
  let candidate = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  while (existing.has(candidate)) {
    hours = (hours + 1) % 24
    candidate = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }
  settings.value.times = reminderTimes({ times: [...settings.value.times, candidate] })
  settings.value.time = settings.value.times[0]
  persist()
}

function removeTime(index) {
  if (!settings.value || settings.value.times.length <= 1) return
  settings.value.times = settings.value.times.filter((_, current) => current !== index)
  settings.value.time = settings.value.times[0]
  persist()
}

async function enableNotifications() {
  await requestPermission()
  await persist()
}

async function testNotification() {
  await sendTestNotification()
}

const permissionLabel = {
  granted: 'Allowed',
  denied: 'Blocked in the browser',
  default: 'Not asked yet',
}

onMounted(async () => {
  settings.value = await getSettings()
  await refreshSchedule()
})
</script>

<template>
  <section>
    <p class="text-sm font-semibold uppercase tracking-[0.22em] text-neon">Preferences</p>
    <h1 class="mt-1 font-display text-3xl text-ink">Settings</h1>
    <p class="mt-2 text-sm leading-6 text-muted">
      Choose when Worknote should nudge you. Notes never leave this device.
    </p>

    <div v-if="settings" class="mt-6 space-y-4">
      <section v-if="permission === 'granted'" class="rounded-3xl border border-line bg-card p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="font-display text-xl text-ink">Reminders</h2>
            <p class="mt-1 text-sm text-muted">A notification on the days and times you pick.</p>
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
            class="rounded-full px-3 py-1.5 text-sm font-bold"
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

        <p class="mt-4 text-sm font-medium text-ink">Times</p>
        <ul class="mt-2 space-y-2">
          <li v-for="(time, index) in settings.times" :key="index" class="flex gap-2">
            <label class="sr-only" :for="`reminder-time-${index}`">Reminder time {{ index + 1 }}</label>
            <input
              :id="`reminder-time-${index}`"
              :value="time"
              type="time"
              class="min-w-0 flex-1 rounded-2xl border border-line bg-paper px-3 py-2 text-ink"
              @change="updateTime(index, $event.target.value)"
            />
            <button
              type="button"
              class="rounded-full border border-line px-3 py-2 text-sm font-semibold text-ink disabled:opacity-40"
              :disabled="settings.times.length <= 1"
              @click="removeTime(index)"
            >
              Remove
            </button>
          </li>
        </ul>
        <button
          v-if="settings.times.length < MAX_TIMES"
          type="button"
          class="mt-3 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink"
          @click="addTime"
        >
          Add a time
        </button>
      </section>

      <section class="rounded-3xl border border-line bg-card p-4">
        <h2 class="font-display text-xl text-ink">Notifications</h2>
        <p class="mt-1 text-sm leading-6 text-muted">
          <template v-if="permission !== 'granted'">
            Enable notifications so Worknote can create reminder notifications. You can pick days
            and times after that.
          </template>
          <template v-else>
            Status: {{ permissionLabel[permission] }}. Android needs Worknote installed on the home
            screen, then Allow notifications. The banner may not pop while the app is open — check
            the notification shade. iPhone can still miss scheduled web notifications unless the app
            is opened that day.
          </template>
        </p>
        <p v-if="permission === 'denied'" class="mt-2 text-sm leading-6 text-muted">
          Notifications are blocked in this browser. Allow them in the site settings, then return
          here to set reminders.
        </p>
        <p v-else-if="permission === 'granted'" class="mt-2 text-sm leading-6 text-muted">
          Background reminders:
          {{ backgroundReady ? 'on for this installed app' : 'only while Worknote is open' }}.
        </p>
        <button
          v-if="permission !== 'granted'"
          type="button"
          class="mt-4 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-on-accent"
          @click="enableNotifications"
        >
          Allow notifications
        </button>
        <button
          v-else
          type="button"
          class="mt-4 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink"
          @click="testNotification"
        >
          Send a test notification
        </button>
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

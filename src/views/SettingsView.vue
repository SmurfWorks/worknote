<script setup>
import { computed, onMounted, ref } from 'vue'
import { useOnboarding } from '../composables/useOnboarding'
import { useReminders } from '../composables/useReminders'
import { showToast } from '../composables/useToasts'
import { getSettings, saveSettings } from '../lib/db'
import { isIos } from '../lib/device'
import { cleanPushUrl, pageOrigin } from '../lib/push'
import { chosenTimezone, supportedTimeZones, timezoneChoices } from '../lib/timezone'
import { normalizeTime, reminderTimes, WEEKDAYS } from '../lib/types'

const settings = ref(null)
const pushUrl = ref('')
const pushToken = ref('')
const { permission, connection, connectionError, allowNotifications, syncReminders } = useReminders()
const { show: showOnboarding } = useOnboarding()
const origin = pageOrigin(location.href)
const timezones = timezoneChoices(supportedTimeZones(), new Date())

const notificationsSupported = computed(() => permission.value !== 'unsupported')
const remindersOn = computed(
  () => Boolean(settings.value?.remindersEnabled) && permission.value === 'granted',
)
const serverReady = computed(() => remindersOn.value && connection.value === 'ready')

const statusText = computed(() => {
  if (!notificationsSupported.value) {
    return isIos()
      ? 'To get reminders on an iPhone or iPad, add Worknote to your Home Screen and open it from there.'
      : 'This browser can’t show notifications.'
  }
  if (permission.value === 'denied') {
    return 'Notifications are blocked for Worknote. Allow them in your browser settings, then turn this on again.'
  }
  if (!remindersOn.value) {
    return 'Get a nudge on the days and times you pick. Reminders are sent by your PWA Push server, even while Worknote is closed.'
  }
  if (!settings.value.pushUrl || !settings.value.pushToken) {
    return 'Enter your reminder server address and token.'
  }
  if (connectionError.value && connection.value !== 'ready') return ''
  if (connection.value === 'ready') {
    return 'Connected. Days that already have a note are skipped.'
  }
  return 'Checking that reminder server…'
})

async function persist({ toast = true } = {}) {
  if (!settings.value) return
  const times = reminderTimes({ times: settings.value.times })
  settings.value.times = times
  settings.value.time = times[0] ?? null
  await saveSettings(settings.value)
  if (toast) showToast('Saved')
  await syncReminders()
}

async function toggleReminders(event) {
  if (!settings.value) return
  const wanted = event.target.checked
  const allowed = wanted ? await allowNotifications() : false
  settings.value.remindersEnabled = wanted && allowed
  event.target.checked = settings.value.remindersEnabled
  await persist({ toast: false })
}

async function saveServer() {
  if (!settings.value) return
  const url = cleanPushUrl(pushUrl.value)
  const token = pushToken.value.trim()
  pushUrl.value = url
  pushToken.value = token
  if (url === settings.value.pushUrl && token === settings.value.pushToken) return
  settings.value.pushUrl = url
  settings.value.pushToken = token
  await persist({ toast: false })
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

function formatClock(time) {
  const [hours, minutes] = time.split(':').map(Number)
  const suffix = hours < 12 ? 'am' : 'pm'
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function updateTime(index, value, input) {
  if (!settings.value) return
  const next = normalizeTime(value)
  if (!next) {
    input.value = settings.value.times[index]
    return
  }
  const times = [...settings.value.times]
  times[index] = next
  settings.value.times = reminderTimes({ times })
  persist()
}

function addTime() {
  if (!settings.value) return
  const existing = new Set(settings.value.times)
  let hours = (new Date().getHours() + 1) % 24
  let candidate = `${String(hours).padStart(2, '0')}:00`
  for (let tries = 0; existing.has(candidate) && tries < 24; tries += 1) {
    hours = (hours + 1) % 24
    candidate = `${String(hours).padStart(2, '0')}:00`
  }
  if (existing.has(candidate)) return
  settings.value.times = reminderTimes({ times: [...settings.value.times, candidate] })
  persist()
}

function removeTime(index) {
  if (!settings.value) return
  settings.value.times = settings.value.times.filter((_, current) => current !== index)
  persist()
}

async function changeTimezone(event) {
  if (!settings.value) return
  settings.value.timezone = chosenTimezone(event.target.value)
  await persist()
}

onMounted(async () => {
  settings.value = await getSettings()
  pushUrl.value = settings.value.pushUrl
  pushToken.value = settings.value.pushToken
  await syncReminders()
})
</script>

<template>
  <section>
    <p class="text-sm font-bold uppercase tracking-[0.14em] text-accent">Preferences</p>
    <h1 class="mt-1 font-display text-3xl text-ink">Settings</h1>
    <p class="mt-2 text-sm leading-6 text-muted">
      Choose when Worknote should nudge you. Notes never leave this device.
    </p>

    <div v-if="settings" class="mt-6 space-y-4">
      <section class="rounded-3xl border border-line bg-card p-4">
        <label for="timezone" class="font-display text-xl text-ink">Timezone</label>
        <select
          id="timezone"
          :value="settings.timezone"
          class="mt-2 w-full rounded-2xl border-[1.5px] border-line bg-paper px-3 py-2.5 text-ink outline-none focus:border-accent"
          @change="changeTimezone"
        >
          <option v-for="zone in timezones" :key="zone.id" :value="zone.id">{{ zone.label }}</option>
        </select>
        <p class="mt-2 text-sm leading-6 text-muted">
          This is the timezone registered for this phone on your reminder server. Reminder days and
          times follow it. It starts as the one on this device.
        </p>
      </section>

      <section class="rounded-3xl border border-line bg-card p-4">
        <h2 class="font-display text-xl text-ink">Reminders</h2>
        <label class="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            class="size-[1.15rem] accent-accent"
            :checked="remindersOn"
            :disabled="!notificationsSupported"
            @change="toggleReminders"
          />
          Send reminders
        </label>
        <p v-if="statusText" class="mt-1 text-sm leading-6 text-muted">{{ statusText }}</p>

        <div
          v-if="remindersOn"
          class="mt-4 grid gap-3 rounded-2xl border-[1.5px] bg-paper p-3"
          :class="connectionError ? 'border-warn' : 'border-line'"
        >
          <p class="text-sm leading-6 text-muted select-text">
            This app’s origin is <strong class="break-all font-bold text-ink">{{ origin }}</strong>.
            Register that origin on your reminder server.
          </p>
          <div>
            <label for="push-url" class="text-xs font-semibold text-muted">Reminder server address</label>
            <input
              id="push-url"
              v-model="pushUrl"
              type="text"
              inputmode="url"
              autocapitalize="off"
              autocomplete="off"
              spellcheck="false"
              placeholder="https://example.com"
              class="mt-1 w-full rounded-2xl border-[1.5px] border-line bg-card px-3 py-2 text-ink outline-none focus:border-accent"
              :aria-invalid="connectionError ? 'true' : 'false'"
              @change="saveServer"
            />
          </div>
          <div>
            <label for="push-token" class="text-xs font-semibold text-muted">Reminder server token</label>
            <input
              id="push-token"
              v-model="pushToken"
              type="text"
              autocapitalize="off"
              autocomplete="off"
              spellcheck="false"
              placeholder="Token from your PWA Push app"
              class="mt-1 w-full rounded-2xl border-[1.5px] border-line bg-card px-3 py-2 text-ink outline-none focus:border-accent"
              :aria-invalid="connectionError ? 'true' : 'false'"
              @change="saveServer"
            />
          </div>
          <p v-if="connectionError" class="text-sm font-semibold text-warn" role="alert">
            {{ connectionError }}
          </p>
        </div>

        <template v-if="serverReady">
          <p class="mt-4 text-sm font-semibold text-ink">Days</p>
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

          <p id="reminder-times-label" class="mt-4 text-sm font-semibold text-ink">
            Remind me at these times if I haven’t written a note
          </p>
          <ul class="mt-2 space-y-2" aria-labelledby="reminder-times-label">
            <li v-for="(time, index) in settings.times" :key="time" class="flex items-center gap-2">
              <input
                :value="time"
                type="time"
                class="min-w-0 flex-1 rounded-2xl border-[1.5px] border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
                aria-label="Reminder time"
                @change="updateTime(index, $event.target.value, $event.target)"
              />
              <button
                type="button"
                class="flex size-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-muted"
                :aria-label="`Remove the ${formatClock(time)} reminder`"
                @click="removeTime(index)"
              >
                ×
              </button>
            </li>
          </ul>
          <button
            type="button"
            class="mt-3 rounded-full bg-accent-soft px-4 py-2.5 text-sm font-bold text-accent"
            @click="addTime"
          >
            + Add a time
          </button>
        </template>
      </section>

      <section class="rounded-3xl border border-line bg-card p-4">
        <h2 class="font-display text-xl text-ink">On this device</h2>
        <p class="mt-1 text-sm leading-6 text-muted">
          Notes are stored in this browser’s local database. Dictate uses the
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

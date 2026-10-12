import { ref } from 'vue'
import { getSettings, listNoteDates } from '../lib/db'
import {
  checkPushConnection,
  ensurePushDevice,
  forgetPushDevice,
  pushAuth,
  pushUrlIsReachable,
  replaceNotifications,
  storedPushDevice,
  storedPushDeviceId,
} from '../lib/push'
import { scheduledReminders } from '../lib/reminders'

/** How often bookings are brought in line with the clock while Worknote is open. */
const CHECK_MS = 5 * 60 * 1000

function currentPermission() {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

// Shared by every caller, so Settings and the app shell see the same connection.
const permission = ref(currentPermission())
/** 'idle' before a server is entered, 'checking' while it is tried, 'ready' once it accepted the token. */
const connection = ref('idle')
const connectionError = ref('')

let started = false
let lastBooked = ''
let queue = Promise.resolve()

function sameAuth(a, b) {
  return a?.baseUrl === b?.baseUrl && a?.token === b?.token
}

function showConnection(state, error = '') {
  connection.value = state
  connectionError.value = error
}

/** null while the address or token is still missing, a message when they cannot work, otherwise ''. */
function localServerError(settings) {
  if (!settings.pushUrl || !settings.pushToken) return null
  const auth = pushAuth(settings.pushUrl, settings.pushToken)
  if (!auth) return 'Enter a reminder server address like https://example.com.'
  if (!pushUrlIsReachable(auth.baseUrl, location.protocol)) {
    return 'Use an https address. This page cannot reach an http reminder server.'
  }
  return ''
}

/** Withdraws everything booked with a server this phone no longer uses. */
async function releaseOldServer(auth) {
  const previous = storedPushDevice()
  if (!previous || sameAuth(previous.auth, auth)) return
  forgetPushDevice()
  lastBooked = ''
  try {
    await replaceNotifications(previous.auth, previous.id, [])
  } catch {
    // That server may already be gone. This phone stops using it either way.
  }
}

async function clearBookings(auth) {
  if (lastBooked === '[]') return
  const deviceId = auth && storedPushDeviceId(auth)
  if (deviceId && pushUrlIsReachable(auth.baseUrl, location.protocol)) {
    try {
      await replaceNotifications(auth, deviceId, [])
    } catch {
      // Tried again next time.
      return
    }
  }
  lastBooked = '[]'
}

async function sync() {
  const settings = await getSettings()
  const auth = pushAuth(settings.pushUrl, settings.pushToken)
  permission.value = currentPermission()
  await releaseOldServer(auth)

  if (!settings.remindersEnabled || permission.value !== 'granted') {
    await clearBookings(auth)
    showConnection('idle')
    return
  }

  const local = localServerError(settings)
  if (local === null) {
    showConnection('idle')
    return
  }
  if (local) {
    showConnection('idle', local)
    return
  }

  if (connection.value !== 'ready') showConnection('checking')
  const check = await checkPushConnection(auth)
  if (!check.ok) {
    lastBooked = ''
    showConnection('idle', check.message)
    return
  }
  showConnection('ready')

  const links = {
    url: new URL('./', document.baseURI).href,
    icon: new URL('icon-192.png', document.baseURI).href,
  }
  const wanted = scheduledReminders(settings, await listNoteDates()).map((item) => ({ ...item, ...links }))

  try {
    const deviceId = await ensurePushDevice(auth, settings.timezone)
    if (!deviceId) {
      showConnection(
        'ready',
        'This browser cannot receive reminders from a server. Open Worknote from your Home Screen and try again.',
      )
      return
    }
    const plan = JSON.stringify(wanted)
    if (plan === lastBooked) return
    await replaceNotifications(auth, deviceId, wanted)
    lastBooked = plan
  } catch (error) {
    lastBooked = ''
    showConnection('ready', error instanceof Error ? error.message : 'Worknote could not book reminders with that server.')
  }
}

/** Books reminders on the server to match the settings and notes. Calls run one after another. */
export function syncReminders() {
  queue = queue.then(sync).catch(() => {
    lastBooked = ''
  })
  return queue
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') syncReminders()
}

export function useReminders() {
  /** Asks for notification permission if needed. Resolves true when notifications are allowed. */
  async function allowNotifications() {
    if (typeof Notification === 'undefined') return false
    if (Notification.permission !== 'granted') {
      try {
        await Notification.requestPermission()
      } catch {
        // Treated as not allowed below.
      }
    }
    permission.value = currentPermission()
    return permission.value === 'granted'
  }

  function startReminderLoop() {
    if (started) return syncReminders()
    started = true
    document.addEventListener('visibilitychange', onVisibilityChange)
    setInterval(syncReminders, CHECK_MS)
    return syncReminders()
  }

  return {
    permission,
    connection,
    connectionError,
    allowNotifications,
    syncReminders,
    startReminderLoop,
  }
}

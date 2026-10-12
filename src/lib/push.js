// Talks to a PWA Push server (sw-pwa-push), the same way Dosage Helper does. The server stores this
// phone's push subscription and the reminders booked for it, and sends each one at its time.

const DEVICE_KEY = 'worknote.push-device.v1'

/** A reminder missed while the phone was offline still arrives if it comes back within this long. */
export const REMINDER_GRACE_MINUTES = 30

/** Address and token from Settings. Empty or unusable values give null and nothing is booked. */
export function pushAuth(url, token) {
  const trimmedToken = String(token ?? '').trim()
  const baseUrl = cleanPushUrl(url)
  if (!trimmedToken || !baseUrl) return null
  try {
    const parsed = new URL(baseUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (parsed.username || parsed.password) return null
  } catch {
    return null
  }
  return { baseUrl, token: trimmedToken }
}

export function cleanPushUrl(url) {
  return String(url ?? '').trim().replace(/\/+$/, '')
}

/** Scheme, host and port of a page, without the path. This is what the server checks requests against. */
export function pageOrigin(pageUrl) {
  return new URL(pageUrl).origin
}

/** A secure page cannot call an http server. */
export function pushUrlIsReachable(baseUrl, pageProtocol) {
  try {
    return !(pageProtocol === 'https:' && new URL(baseUrl).protocol === 'http:')
  } catch {
    return false
  }
}

/** The bytes `pushManager.subscribe` expects for the server's public key. */
export function applicationServerKey(publicKey) {
  const padding = '='.repeat((4 - (publicKey.length % 4)) % 4)
  const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function storage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readDevice() {
  const raw = storage()?.getItem(DEVICE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.id === 'string' && typeof parsed.baseUrl === 'string' && typeof parsed.token === 'string') {
      return {
        id: parsed.id,
        baseUrl: parsed.baseUrl,
        token: parsed.token,
        timezone: typeof parsed.timezone === 'string' ? parsed.timezone : '',
      }
    }
  } catch {
    // Unreadable; the phone registers again.
  }
  return null
}

/** The server this phone last registered with, if any. */
export function storedPushDevice() {
  const stored = readDevice()
  return stored ? { id: stored.id, auth: { baseUrl: stored.baseUrl, token: stored.token } } : null
}

export function storedPushDeviceId(auth) {
  const stored = readDevice()
  if (!stored || stored.baseUrl !== auth.baseUrl || stored.token !== auth.token) return null
  return stored.id
}

function rememberDevice(auth, id, timezone) {
  storage()?.setItem(DEVICE_KEY, JSON.stringify({ id, baseUrl: auth.baseUrl, token: auth.token, timezone }))
}

export function forgetPushDevice() {
  storage()?.removeItem(DEVICE_KEY)
}

function authHeaders(auth, json = false) {
  return {
    Authorization: `Bearer ${auth.token}`,
    Accept: 'application/json',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  }
}

/** Confirms the address and token are accepted. Listing devices is enough; nothing is booked. */
export async function checkPushConnection(auth, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(`${auth.baseUrl}/api/devices`, { headers: authHeaders(auth) })
    if (response.status === 401) return { ok: false, message: 'That reminder server token was not accepted.' }
    if (!response.ok) return { ok: false, message: `The reminder server responded ${response.status}.` }
    return { ok: true }
  } catch {
    return {
      ok: false,
      message: 'Worknote could not reach that reminder server. Check the address, and that this app’s origin is registered there.',
    }
  }
}

function validationError(message) {
  if (/timezone/i.test(message)) return 'The reminder server does not know this phone’s timezone.'
  if (/does not exist/i.test(message)) return 'That reminder time does not exist in your timezone.'
  return 'Register this app’s origin on the reminder server.'
}

async function asJson(response, forgetOnMissing = false) {
  if (response.status === 404 && forgetOnMissing) {
    forgetPushDevice()
    throw new Error('This phone is no longer registered for reminders.')
  }
  if (response.status === 422) {
    let message = ''
    try {
      const body = await response.json()
      if (typeof body?.message === 'string') message = body.message
    } catch {
      // The status is enough when the server sends no details.
    }
    const error = new Error(validationError(message))
    error.timeDoesNotExist = /does not exist/i.test(message)
    throw error
  }
  if (!response.ok) throw new Error(`The reminder server responded ${response.status}.`)
  if (response.status === 204) return null
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function postDevice(auth, timezone, subscription, fetchImpl) {
  const response = await fetchImpl(`${auth.baseUrl}/api/devices`, {
    method: 'POST',
    headers: authHeaders(auth, true),
    body: JSON.stringify({ timezone, subscription: subscription.toJSON() }),
  })
  const body = await asJson(response)
  if (!body?.id) throw new Error('The reminder server did not register this phone.')
  rememberDevice(auth, body.id, timezone)
  return body.id
}

/**
 * Registers this phone, or updates its timezone when that has changed.
 * A phone already registered for this server keeps its subscription.
 */
export async function ensurePushDevice(auth, timezone, fetchImpl = fetch) {
  const stored = readDevice()
  const sameServer = stored !== null && stored.baseUrl === auth.baseUrl && stored.token === auth.token
  if (sameServer && stored.timezone === timezone) return stored.id
  const fallback = sameServer ? stored.id : null
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return fallback
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return fallback
  if (typeof window === 'undefined' || !('PushManager' in window)) return fallback
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration?.pushManager) return fallback

  const current = await registration.pushManager.getSubscription()
  if (sameServer && current) return postDevice(auth, timezone, current, fetchImpl)

  if (current) await current.unsubscribe()
  const keyResponse = await fetchImpl(`${auth.baseUrl}/api/vapid-public-key`, { headers: { Accept: 'application/json' } })
  const keyBody = await asJson(keyResponse)
  if (!keyBody?.publicKey) throw new Error('The reminder server has no public key.')
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(keyBody.publicKey),
  })
  return postDevice(auth, timezone, subscription, fetchImpl)
}

/** Makes the server's waiting reminders for this phone match `wanted`. */
export async function replaceNotifications(auth, deviceId, wanted, fetchImpl = fetch) {
  const root = `${auth.baseUrl}/api/devices/${deviceId}/notifications`
  if (wanted.length === 0) {
    await asJson(await fetchImpl(root, { method: 'DELETE', headers: authHeaders(auth) }), true)
    return
  }

  const current = await asJson(await fetchImpl(root, { headers: authHeaders(auth) }), true)
  const keys = new Set(wanted.map((item) => item.key))
  for (const existing of current?.notifications ?? []) {
    if (keys.has(existing.key)) continue
    // A reminder already sent or skipped stays on the server as a record of when it went out.
    if (existing.status === 'sent' || existing.status === 'skipped') continue
    const removed = await fetchImpl(`${root}/${encodeURIComponent(existing.key)}`, {
      method: 'DELETE',
      headers: authHeaders(auth),
    })
    if (removed.status === 404) continue
    await asJson(removed)
  }

  for (const item of wanted) {
    try {
      await bookOne(root, auth, item, fetchImpl)
    } catch (error) {
      // A clock time skipped when the clocks go forward has nothing to deliver at.
      if (!error?.timeDoesNotExist) throw error
    }
  }
}

async function bookOne(root, auth, item, fetchImpl) {
  const response = await fetchImpl(`${root}/${encodeURIComponent(item.key)}`, {
    method: 'PUT',
    headers: authHeaders(auth, true),
    body: JSON.stringify({
      deliver_at: item.deliverAt,
      title: item.title,
      body: item.body,
      tag: item.tag,
      grace_minutes: REMINDER_GRACE_MINUTES,
      ...(item.url ? { url: item.url } : {}),
      ...(item.icon ? { icon: item.icon } : {}),
    }),
  })
  await asJson(response)
}

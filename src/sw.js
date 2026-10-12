import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
self.skipWaiting()
clientsClaim()

// A reminder from the PWA Push server, shown even when Worknote is closed.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  if (!data || typeof data !== 'object') data = {}
  const title = typeof data.title === 'string' && data.title ? data.title : 'Worknote'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      tag: typeof data.tag === 'string' ? data.tag : 'worknote-daily',
      icon: new URL('icon-192.png', self.registration.scope).href,
      data: { url: typeof data.url === 'string' ? data.url : self.registration.scope },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(openApp())
})

async function openApp() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of windows) {
    if ('focus' in client) {
      await client.focus()
      return
    }
  }
  await self.clients.openWindow(self.registration.scope)
}

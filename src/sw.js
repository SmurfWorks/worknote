import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { maybeNotifyFromServiceWorker } from './lib/reminders'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
self.skipWaiting()
clientsClaim()

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(openApp())
})

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'worknote-reminder') {
    event.waitUntil(maybeNotifyFromServiceWorker(self.registration))
  }
})

self.addEventListener('message', (event) => {
  if (event.data === 'check-reminder') {
    maybeNotifyFromServiceWorker(self.registration)
  }
})

async function openApp() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of windows) {
    if ('focus' in client) {
      await client.focus()
      return
    }
  }
  await self.clients.openWindow('./')
}

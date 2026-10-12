import { createRouter, createWebHashHistory } from 'vue-router'
import HistoryView from './views/HistoryView.vue'
import SettingsView from './views/SettingsView.vue'
import TodayView from './views/TodayView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'today', component: TodayView, meta: { tab: 'today' } },
    { path: '/history', name: 'history', component: HistoryView, meta: { tab: 'history' } },
    // Older links to a day open it on Today, like any other date.
    { path: '/note/:date', redirect: (to) => ({ path: '/', query: { date: to.params.date } }) },
    { path: '/settings', name: 'settings', component: SettingsView, meta: { tab: 'settings' } },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router

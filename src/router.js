import { createRouter, createWebHashHistory } from 'vue-router'
import HistoryView from './views/HistoryView.vue'
import NoteView from './views/NoteView.vue'
import SettingsView from './views/SettingsView.vue'
import TodayView from './views/TodayView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'today', component: TodayView, meta: { tab: 'today' } },
    { path: '/history', name: 'history', component: HistoryView, meta: { tab: 'history' } },
    { path: '/note/:date', name: 'note', component: NoteView, meta: { tab: 'history' } },
    { path: '/settings', name: 'settings', component: SettingsView, meta: { tab: 'settings' } },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router

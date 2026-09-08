<script setup>
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import DateBar from './DateBar.vue'
import ToastStack from './ToastStack.vue'
import { useDayDate } from '../composables/useDayDate'

const route = useRoute()
const { showDateBar } = useDayDate()
const showBack = computed(() => route.name === 'note')
const activeTab = computed(() => route.meta.tab ?? 'today')
</script>

<template>
  <div
    class="relative mx-auto flex h-full max-h-full max-w-lg flex-col overflow-hidden bg-paper pt-[env(safe-area-inset-top)]"
  >
    <header
      v-if="showBack"
      class="flex shrink-0 items-center gap-2 border-b border-line bg-paper/90 px-3 py-3 backdrop-blur"
    >
      <RouterLink
        to="/history"
        class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-accent hover:bg-accent-soft"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" aria-hidden="true">
          <path
            d="M15 6 9 12l6 6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        History
      </RouterLink>
    </header>

    <main class="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
      <RouterView v-slot="{ Component }">
        <component :is="Component" />
      </RouterView>
    </main>

    <ToastStack />
    <nav class="shrink-0 border-t border-line bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <DateBar v-if="showDateBar" />
      <ul class="grid grid-cols-3">
        <li>
          <RouterLink
            to="/"
            class="flex flex-col items-center gap-1 py-3 text-xs font-semibold"
            :class="activeTab === 'today' ? 'text-accent' : 'text-muted'"
          >
            <svg viewBox="0 0 24 24" class="size-6" fill="none" aria-hidden="true">
              <rect x="4" y="5" width="16" height="15" rx="3" stroke="currentColor" stroke-width="1.8" />
              <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
            Today
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/history"
            class="flex flex-col items-center gap-1 py-3 text-xs font-semibold"
            :class="activeTab === 'history' ? 'text-accent' : 'text-muted'"
          >
            <svg viewBox="0 0 24 24" class="size-6" fill="none" aria-hidden="true">
              <path
                d="M5 6h14M5 12h14M5 18h9"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
            History
          </RouterLink>
        </li>
        <li>
          <RouterLink
            to="/settings"
            class="flex flex-col items-center gap-1 py-3 text-xs font-semibold"
            :class="activeTab === 'settings' ? 'text-accent' : 'text-muted'"
          >
            <svg viewBox="0 0 24 24" class="size-6" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" />
              <path
                d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20M6.3 6.3l1.6 1.6M16.1 16.1l1.6 1.6M6.3 17.7l1.6-1.6M16.1 7.9l1.6-1.6"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
            Settings
          </RouterLink>
        </li>
      </ul>
    </nav>
  </div>
</template>

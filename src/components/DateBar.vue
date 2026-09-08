<script setup>
import { isDateKey, shiftDateKey } from '../lib/dates'
import { useDayDate } from '../composables/useDayDate'

const { date, dateValid, isToday, goToDate, jumpToToday, recording } = useDayDate()
</script>

<template>
  <div class="border-b border-line px-3 py-2">
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink disabled:opacity-40"
        :disabled="recording || !dateValid"
        aria-label="Previous day"
        @click="goToDate(shiftDateKey(date, -1))"
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
      </button>
      <label class="sr-only" for="footer-note-date">Note date</label>
      <input
        id="footer-note-date"
        :value="date"
        type="date"
        class="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-center text-sm font-medium text-ink disabled:opacity-40"
        :disabled="recording"
        @change="goToDate($event.target.value)"
      />
      <button
        type="button"
        class="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink disabled:opacity-40"
        :disabled="recording || !dateValid"
        aria-label="Next day"
        @click="goToDate(shiftDateKey(date, 1))"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" aria-hidden="true">
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
    <button
      v-if="!isToday && isDateKey(date)"
      type="button"
      class="mt-1 w-full text-xs font-semibold text-accent disabled:opacity-40"
      :disabled="recording"
      @click="jumpToToday"
    >
      Jump to today
    </button>
  </div>
</template>

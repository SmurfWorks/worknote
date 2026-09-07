<script setup>
import { onMounted } from 'vue'
import AppShell from './components/AppShell.vue'
import { useReminders } from './composables/useReminders'

const { startReminderLoop } = useReminders()

onMounted(() => {
  startReminderLoop()
})
</script>

<template>
  <AppShell />
</template>

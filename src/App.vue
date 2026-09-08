<script setup>
import { onMounted } from 'vue'
import AppShell from './components/AppShell.vue'
import SplashScreen from './components/SplashScreen.vue'
import { useOnboarding } from './composables/useOnboarding'
import { useReminders } from './composables/useReminders'

const { open } = useOnboarding()
const { startReminderLoop } = useReminders()

onMounted(() => {
  startReminderLoop()
})
</script>

<template>
  <AppShell :inert="open" />
  <SplashScreen />
</template>

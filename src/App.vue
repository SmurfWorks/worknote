<script setup>
import { onMounted, watch } from 'vue'
import AppShell from './components/AppShell.vue'
import InstallGate from './components/InstallGate.vue'
import SplashScreen from './components/SplashScreen.vue'
import { useInstallPrompt } from './composables/useInstallPrompt'
import { useOnboarding } from './composables/useOnboarding'
import { useReminders } from './composables/useReminders'

const { canUseApp } = useInstallPrompt()
const { open } = useOnboarding()
const { startReminderLoop } = useReminders()

function startAppServices() {
  if (!canUseApp.value) return
  startReminderLoop()
}

onMounted(startAppServices)
watch(canUseApp, (allowed) => {
  if (allowed) startAppServices()
})
</script>

<template>
  <InstallGate v-if="!canUseApp" />
  <template v-else>
    <AppShell :inert="open" />
    <SplashScreen />
  </template>
</template>

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { startInstallPrompt } from './composables/useInstallPrompt'
import './style.css'

startInstallPrompt()

createApp(App).use(router).mount('#app')

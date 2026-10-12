import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isDateKey, todayKey } from '../lib/dates'

export const dayRecording = ref(false)

let persistBeforeLeave = null

export function setDayLeaveHandler(fn) {
  persistBeforeLeave = fn
}

export function useDayDate() {
  const route = useRoute()
  const router = useRouter()

  const date = computed(() => {
    const fromQuery = String(route.query.date ?? '')
    if (isDateKey(fromQuery)) return fromQuery
    return todayKey()
  })

  const dateValid = computed(() => isDateKey(date.value))
  const isToday = computed(() => date.value === todayKey())
  const showDateBar = computed(() => route.name === 'today')

  function goToDate(nextKey) {
    if (dayRecording.value || !isDateKey(nextKey)) return
    persistBeforeLeave?.()
    if (nextKey === todayKey()) {
      router.replace({ path: '/' })
      return
    }
    router.replace({ path: '/', query: { date: nextKey } })
  }

  function jumpToToday() {
    if (dayRecording.value) return
    persistBeforeLeave?.()
    router.push({ path: '/' })
  }

  return {
    date,
    dateValid,
    isToday,
    showDateBar,
    goToDate,
    jumpToToday,
    recording: dayRecording,
  }
}

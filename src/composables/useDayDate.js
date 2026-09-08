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
    const fromParams = String(route.params.date ?? '')
    const fromQuery = String(route.query.date ?? '')
    if (route.name === 'note') {
      return isDateKey(fromParams) ? fromParams : ''
    }
    if (isDateKey(fromQuery)) return fromQuery
    return todayKey()
  })

  const dateValid = computed(() => isDateKey(date.value))
  const isToday = computed(() => date.value === todayKey())
  const showDateBar = computed(() => route.name === 'today' || route.name === 'note')

  function goToDate(nextKey) {
    if (dayRecording.value || !isDateKey(nextKey)) return
    persistBeforeLeave?.()
    if (route.name === 'note') {
      router.replace({ name: 'note', params: { date: nextKey } })
      return
    }
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

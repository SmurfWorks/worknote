import { computed, ref } from 'vue'
import { isMobileDevice } from '../lib/device'

function getSpeechCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function useTranscription() {
  const isSupported = computed(() => Boolean(getSpeechCtor()))
  const isListening = ref(false)
  const finalText = ref('')
  const interimText = ref('')
  const error = ref(null)

  let recognition = null
  let shouldRun = false
  let captureRetries = 0
  let restartTimer = 0

  const liveText = computed(() => {
    const parts = [finalText.value.trim(), interimText.value.trim()].filter(Boolean)
    return parts.join(' ')
  })

  function clearRestart() {
    if (restartTimer) {
      window.clearTimeout(restartTimer)
      restartTimer = 0
    }
  }

  function restartSoon(delay = 60) {
    clearRestart()
    restartTimer = window.setTimeout(() => {
      restartTimer = 0
      if (!shouldRun || !recognition) return
      try {
        recognition.start()
        isListening.value = true
      } catch {
        // Already started, or the browser refused a restart.
      }
    }, delay)
  }

  function start() {
    const Ctor = getSpeechCtor()
    error.value = null
    finalText.value = ''
    interimText.value = ''
    captureRetries = 0
    clearRestart()

    if (!Ctor) {
      error.value = 'Live captions are not available in this browser. You can type the note instead.'
      return
    }

    const mobile = isMobileDevice()
    recognition = new Ctor()
    recognition.continuous = !mobile
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.lang = navigator.language || 'en-US'
    shouldRun = true

    recognition.onresult = (event) => {
      captureRetries = 0
      if (mobile) {
        let interim = ''
        let utterance = ''
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i]
          const chunk = (result?.[0]?.transcript ?? '').trim()
          if (!chunk) continue
          if (result.isFinal) utterance = chunk
          else interim += `${chunk} `
        }
        if (utterance && !finalText.value.endsWith(utterance)) {
          finalText.value = `${finalText.value} ${utterance}`.trim()
        }
        interimText.value = interim.trim()
        return
      }

      let interim = ''
      let finals = finalText.value
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const chunk = result?.[0]?.transcript ?? ''
        if (result?.isFinal) {
          finals = `${finals} ${chunk}`.trim()
        } else {
          interim += chunk
        }
      }
      finalText.value = finals
      interimText.value = interim.trim()
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      if (event.error === 'audio-capture') {
        captureRetries += 1
        if (captureRetries <= 3 && shouldRun) {
          restartSoon(250)
          return
        }
        error.value =
          'Live captions could not use the microphone. Your audio is still saved — type the note if needed.'
        return
      }
      if (event.error === 'network') {
        error.value = 'Live captions need a network connection in this browser.'
        return
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        error.value = 'Speech recognition was blocked. You can still save the recording and type the note.'
        shouldRun = false
      }
    }

    recognition.onend = () => {
      isListening.value = false
      if (shouldRun) restartSoon(mobile ? 80 : 0)
    }

    try {
      recognition.start()
      isListening.value = true
    } catch {
      error.value = 'Could not start live captions. You can type the note after recording.'
    }
  }

  function stop() {
    shouldRun = false
    clearRestart()
    try {
      recognition?.stop()
    } catch {
      recognition?.abort()
    }
    recognition = null
    isListening.value = false
    const text = liveText.value.trim()
    interimText.value = ''
    return text
  }

  return {
    isSupported,
    isListening,
    liveText,
    error,
    start,
    stop,
  }
}

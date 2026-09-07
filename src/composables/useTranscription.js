import { computed, ref } from 'vue'

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

  const liveText = computed(() => {
    const parts = [finalText.value.trim(), interimText.value.trim()].filter(Boolean)
    return parts.join(' ')
  })

  function start() {
    const Ctor = getSpeechCtor()
    error.value = null
    finalText.value = ''
    interimText.value = ''

    if (!Ctor) {
      error.value = 'Live captions are not available in this browser. You can type the note instead.'
      return
    }

    recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'
    shouldRun = true

    recognition.onresult = (event) => {
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
      if (event.error === 'not-allowed') {
        error.value = 'Speech recognition was blocked. You can still save the recording and type the note.'
        shouldRun = false
      }
    }

    recognition.onend = () => {
      isListening.value = false
      if (shouldRun) {
        try {
          recognition?.start()
          isListening.value = true
        } catch {
          // Already started, or the browser refused a restart.
        }
      }
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

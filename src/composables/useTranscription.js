import { computed, ref } from 'vue'
import { isIos, isMobileDevice } from '../lib/device'

/** How long to wait for the browser's last result after asking it to stop. */
const STOP_WAIT_MS = 2000

function getSpeechCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

function joinText(...parts) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
}

/**
 * The text of one recognition session, rebuilt from every result each time. Rebuilding avoids
 * relying on `resultIndex`, which some browsers report inconsistently. Mobile browsers can repeat
 * the whole utterance so far in each new result, so there a result that extends or repeats the
 * text already gathered replaces it rather than being added again.
 */
export function sessionTranscript(results, collapseRepeats = false) {
  let text = ''
  for (let i = 0; i < results.length; i += 1) {
    const chunk = (results[i]?.[0]?.transcript ?? '').trim()
    if (!chunk) continue
    if (!collapseRepeats) {
      text = joinText(text, chunk)
      continue
    }
    const lowerText = text.toLowerCase()
    const lowerChunk = chunk.toLowerCase()
    if (lowerChunk.startsWith(lowerText)) text = chunk
    else if (!lowerText.endsWith(lowerChunk)) text = joinText(text, chunk)
  }
  return text
}

export function useTranscription() {
  const isSupported = computed(() => Boolean(getSpeechCtor()))
  const isListening = ref(false)
  /** Text from sessions that have ended. The browser ends a session after a pause, and it is restarted. */
  const committedText = ref('')
  /** Text from the current session, final and interim together. */
  const sessionText = ref('')
  const error = ref(null)

  let recognition = null
  let shouldRun = false
  let captureRetries = 0
  let restartTimer = 0
  let finishStop = null

  const liveText = computed(() => joinText(committedText.value, sessionText.value))

  function commitSession() {
    committedText.value = joinText(committedText.value, sessionText.value)
    sessionText.value = ''
  }

  function clearRestart() {
    if (restartTimer) {
      window.clearTimeout(restartTimer)
      restartTimer = 0
    }
  }

  function begin() {
    if (!recognition) return
    try {
      recognition.start()
      isListening.value = true
    } catch {
      // Already started, or the browser refused.
    }
  }

  function restartSoon(delay = 60) {
    clearRestart()
    restartTimer = window.setTimeout(() => {
      restartTimer = 0
      if (shouldRun) begin()
    }, delay)
  }

  function start() {
    const Ctor = getSpeechCtor()
    error.value = null
    committedText.value = ''
    sessionText.value = ''
    captureRetries = 0
    finishStop = null
    clearRestart()

    if (!Ctor) {
      error.value = 'Live captions are not available in this browser. You can type the note instead.'
      return
    }

    const mobile = isMobileDevice()
    recognition = new Ctor()
    // One long session where possible, so pauses do not need a restart. iOS needs one per phrase.
    recognition.continuous = !isIos()
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.lang = navigator.language || 'en-US'
    shouldRun = true

    recognition.onresult = (event) => {
      captureRetries = 0
      sessionText.value = sessionTranscript(event.results, mobile)
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
      // Words still marked interim when a session ends are kept; the browser will not finalise them now.
      commitSession()
      if (shouldRun) {
        restartSoon(mobile ? 80 : 0)
        return
      }
      finishStop?.()
    }

    begin()
  }

  function finish() {
    finishStop = null
    commitSession()
    recognition = null
    isListening.value = false
    return liveText.value
  }

  /** Stops listening and resolves with the transcript, once the browser has sent its last result. */
  function stop() {
    shouldRun = false
    clearRestart()
    if (!recognition || !isListening.value) return Promise.resolve(finish())
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => finishStop?.(), STOP_WAIT_MS)
      finishStop = () => {
        window.clearTimeout(timer)
        resolve(finish())
      }
      try {
        recognition.stop()
      } catch {
        recognition.abort()
      }
    })
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

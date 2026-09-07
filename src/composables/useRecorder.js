import { onUnmounted, ref } from 'vue'

function pickMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export function useRecorder() {
  const isRecording = ref(false)
  const elapsedSeconds = ref(0)
  const error = ref(null)
  const levels = ref(Array.from({ length: 16 }, () => 0.08))

  let mediaRecorder = null
  let chunks = []
  let stream = null
  let analyser = null
  let audioContext = null
  let elapsedTimer = null
  let animationFrame = 0

  function stopTracks() {
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    if (animationFrame) cancelAnimationFrame(animationFrame)
    animationFrame = 0
    audioContext?.close()
    audioContext = null
    analyser = null
  }

  function tickLevels() {
    if (!analyser) return
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(data)
    const next = levels.value.map((_, index) => {
      const sample = data[Math.floor((index / levels.value.length) * data.length)] ?? 0
      return Math.max(0.08, sample / 255)
    })
    levels.value = next
    animationFrame = requestAnimationFrame(tickLevels)
  }

  async function start() {
    error.value = null
    chunks = []
    elapsedSeconds.value = 0

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      error.value = 'Microphone access was blocked. Enable it in your browser settings.'
      throw new Error(error.value)
    }

    const mimeType = pickMimeType()
    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream)

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }

    audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 64
    source.connect(analyser)
    tickLevels()

    mediaRecorder.start(250)
    isRecording.value = true
    elapsedTimer = setInterval(() => {
      elapsedSeconds.value += 1
    }, 1000)
  }

  async function stop() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      isRecording.value = false
      stopTracks()
      return null
    }

    const recorder = mediaRecorder
    const mimeType = recorder.mimeType || pickMimeType() || 'audio/webm'
    const durationSeconds = elapsedSeconds.value

    const blob = await new Promise((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }))
      }
      recorder.stop()
    })

    if (elapsedTimer) clearInterval(elapsedTimer)
    elapsedTimer = null
    isRecording.value = false
    levels.value = Array.from({ length: 16 }, () => 0.08)
    stopTracks()
    mediaRecorder = null

    return { blob, mimeType, durationSeconds }
  }

  onUnmounted(() => {
    if (elapsedTimer) clearInterval(elapsedTimer)
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop()
    stopTracks()
  })

  return {
    isRecording,
    elapsedSeconds,
    error,
    levels,
    start,
    stop,
  }
}

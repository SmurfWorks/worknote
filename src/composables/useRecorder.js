import { onUnmounted, ref } from 'vue'
import { shouldCapturePcm } from '../lib/device'
import { encodeWavMono } from '../lib/wav'

function pickMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

function getAudioContextCtor() {
  return window.AudioContext || window.webkitAudioContext || null
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
  let pcmChunks = null
  let pcmSampleRate = 44100
  let scriptProcessor = null
  let silentGain = null

  function stopTracks() {
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    if (animationFrame) cancelAnimationFrame(animationFrame)
    animationFrame = 0
    scriptProcessor?.disconnect()
    scriptProcessor = null
    silentGain?.disconnect()
    silentGain = null
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

  function prepare() {
    const Ctx = getAudioContextCtor()
    if (!Ctx) return
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new Ctx()
    }
    audioContext.resume()
  }

  function startPcmCapture(source) {
    pcmChunks = []
    pcmSampleRate = audioContext.sampleRate
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1)
    silentGain = audioContext.createGain()
    silentGain.gain.value = 0
    scriptProcessor.onaudioprocess = (event) => {
      if (!pcmChunks) return
      pcmChunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
    }
    source.connect(scriptProcessor)
    scriptProcessor.connect(silentGain)
    silentGain.connect(audioContext.destination)
  }

  function startMediaRecorder() {
    const mimeType = pickMimeType()
    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream)

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    mediaRecorder.start(250)
  }

  async function start() {
    error.value = null
    chunks = []
    pcmChunks = null
    elapsedSeconds.value = 0

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      error.value = 'Microphone access was blocked. Enable it in your browser settings.'
      throw new Error(error.value)
    }

    const Ctx = getAudioContextCtor()
    if (Ctx && (!audioContext || audioContext.state === 'closed')) {
      audioContext = new Ctx()
    }
    if (audioContext?.state === 'suspended') {
      await audioContext.resume()
    }

    if (!audioContext) {
      startMediaRecorder()
      isRecording.value = true
      elapsedTimer = setInterval(() => {
        elapsedSeconds.value += 1
      }, 1000)
      return
    }

    const source = audioContext.createMediaStreamSource(stream)
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 64
    source.connect(analyser)
    tickLevels()

    if (shouldCapturePcm() && audioContext?.createScriptProcessor) {
      try {
        startPcmCapture(source)
      } catch {
        startMediaRecorder()
      }
    } else {
      startMediaRecorder()
    }

    isRecording.value = true
    elapsedTimer = setInterval(() => {
      elapsedSeconds.value += 1
    }, 1000)
  }

  async function stop() {
    if (elapsedTimer) clearInterval(elapsedTimer)
    elapsedTimer = null
    const durationSeconds = elapsedSeconds.value

    let blob = null
    let mimeType = 'audio/webm'

    if (pcmChunks) {
      const captured = pcmChunks
      pcmChunks = null
      blob = encodeWavMono(captured, pcmSampleRate)
      mimeType = 'audio/wav'
    } else if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      const recorder = mediaRecorder
      mimeType = recorder.mimeType || pickMimeType() || 'audio/webm'
      blob = await new Promise((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType }))
        }
        recorder.stop()
      })
    }

    isRecording.value = false
    levels.value = Array.from({ length: 16 }, () => 0.08)
    mediaRecorder = null
    stopTracks()

    if (!blob) return null
    return { blob, mimeType, durationSeconds }
  }

  onUnmounted(() => {
    if (elapsedTimer) clearInterval(elapsedTimer)
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop()
    pcmChunks = null
    stopTracks()
  })

  return {
    isRecording,
    elapsedSeconds,
    error,
    levels,
    prepare,
    start,
    stop,
  }
}

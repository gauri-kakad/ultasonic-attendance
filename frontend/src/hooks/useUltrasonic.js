import { useRef, useState, useCallback } from 'react'

// Ultrasonic detection constants
const FFT_SIZE = 8192           // High resolution FFT for precise freq detection
const SAMPLE_RATE = 48000       // Standard sample rate
const FREQ_MIN = 17500          // Detection range (slightly wider than generation)
const FREQ_MAX = 22500
const DETECTION_THRESHOLD = 0.015  // Minimum amplitude to consider signal
const CONFIRMATION_FRAMES = 3   // Must detect consistently for N frames
const NOISE_FLOOR_FRAMES = 20   // Frames to calculate noise floor

/**
 * useUltrasonicDetector
 * Uses Web Audio API + FFT to detect ultrasonic tokens
 * Implements noise floor calibration, band-pass filtering, and signal confirmation
 */
export const useUltrasonicDetector = () => {
  const [isListening, setIsListening] = useState(false)
  const [detectedFrequency, setDetectedFrequency] = useState(null)
  const [signalStrength, setSignalStrength] = useState(0)
  const [status, setStatus] = useState('idle') // idle | calibrating | listening | detected | error
  const [noiseFloor, setNoiseFloor] = useState(0)
  const [permission, setPermission] = useState('unknown')

  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const animFrameRef = useRef(null)
  const streamRef = useRef(null)
  const confirmationRef = useRef({ freq: null, count: 0 })
  const noiseFramesRef = useRef([])
  const onDetectRef = useRef(null)

  /**
   * Convert FFT bin index to frequency
   */
  const binToFreq = useCallback((bin, sampleRate, fftSize) => {
    return (bin * sampleRate) / fftSize
  }, [])

  /**
   * Find peak frequency in ultrasonic range using parabolic interpolation
   * for sub-bin frequency accuracy
   */
  const findPeakFrequency = useCallback((dataArray, sampleRate, fftSize) => {
    const freqResolution = sampleRate / fftSize
    const minBin = Math.floor(FREQ_MIN / freqResolution)
    const maxBin = Math.ceil(FREQ_MAX / freqResolution)

    let maxAmplitude = -Infinity
    let peakBin = -1

    for (let i = minBin; i <= maxBin; i++) {
      // Convert from dB scale (0-255 where 255 = 0dB)
      const amplitude = dataArray[i] / 255.0
      if (amplitude > maxAmplitude) {
        maxAmplitude = amplitude
        peakBin = i
      }
    }

    if (peakBin < 1 || peakBin >= fftSize / 2 - 1) {
      return { frequency: null, amplitude: maxAmplitude }
    }

    // Parabolic interpolation for sub-bin accuracy
    const alpha = dataArray[peakBin - 1] / 255.0
    const beta = dataArray[peakBin] / 255.0
    const gamma = dataArray[peakBin + 1] / 255.0
    const p = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma)
    const interpolatedBin = peakBin + p
    const frequency = interpolatedBin * freqResolution

    return { frequency: Math.round(frequency), amplitude: maxAmplitude }
  }, [])

  /**
   * Apply band-pass filter effect using FFT bin windowing
   * Zeros out frequencies outside our target range
   */
  const applyBandPassWindow = useCallback((dataArray, sampleRate, fftSize) => {
    const freqResolution = sampleRate / fftSize
    const minBin = Math.floor(FREQ_MIN / freqResolution)
    const maxBin = Math.ceil(FREQ_MAX / freqResolution)
    const filtered = new Uint8Array(dataArray.length)
    for (let i = minBin; i <= maxBin; i++) {
      filtered[i] = dataArray[i]
    }
    return filtered
  }, [])

  /**
   * Main detection loop - called on every animation frame
   */
  const detectLoop = useCallback((onDetect) => {
    if (!analyserRef.current) return

    const analyser = analyserRef.current
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(dataArray)

    const sampleRate = audioCtxRef.current.sampleRate
    const fftSize = analyser.fftSize

    // Apply band-pass windowing
    const filtered = applyBandPassWindow(dataArray, sampleRate, fftSize)

    // Find peak in ultrasonic range
    const { frequency, amplitude } = findPeakFrequency(filtered, sampleRate, fftSize)

    // Calibrate noise floor during initial frames
    if (noiseFramesRef.current.length < NOISE_FLOOR_FRAMES) {
      noiseFramesRef.current.push(amplitude)
      if (noiseFramesRef.current.length === NOISE_FLOOR_FRAMES) {
        const avgNoise = noiseFramesRef.current.reduce((a, b) => a + b, 0) / NOISE_FLOOR_FRAMES
        setNoiseFloor(avgNoise)
        setStatus('listening')
        console.log('Noise floor calibrated:', avgNoise.toFixed(4))
      } else {
        setStatus('calibrating')
      }
      animFrameRef.current = requestAnimationFrame(() => detectLoop(onDetect))
      return
    }

    const currentNoiseFloor = noiseFramesRef.current.reduce((a, b) => a + b, 0) / noiseFramesRef.current.length
    const signalAboveNoise = amplitude - currentNoiseFloor
    setSignalStrength(Math.max(0, Math.min(1, signalAboveNoise * 10)))

    // Check if signal is significantly above noise floor
    const isDynamicThreshold = signalAboveNoise > DETECTION_THRESHOLD
    const isAbsoluteThreshold = amplitude > DETECTION_THRESHOLD

    if (frequency && (isDynamicThreshold || isAbsoluteThreshold)) {
      const conf = confirmationRef.current

      if (conf.freq !== null && Math.abs(conf.freq - frequency) < 300) {
        // Same frequency confirmed again
        conf.count++
        if (conf.count >= CONFIRMATION_FRAMES) {
          setDetectedFrequency(frequency)
          setStatus('detected')
          if (onDetect) onDetect(frequency, amplitude)
          confirmationRef.current = { freq: null, count: 0 }
        }
      } else {
        // New frequency candidate
        confirmationRef.current = { freq: frequency, count: 1 }
      }
    } else {
      // No signal - slowly reset confirmation
      if (confirmationRef.current.count > 0) {
        confirmationRef.current.count = Math.max(0, confirmationRef.current.count - 1)
      }
    }

    // Rolling noise floor update (adapts to room ambience)
    noiseFramesRef.current.push(amplitude)
    if (noiseFramesRef.current.length > NOISE_FLOOR_FRAMES * 2) {
      noiseFramesRef.current = noiseFramesRef.current.slice(-NOISE_FLOOR_FRAMES)
    }

    animFrameRef.current = requestAnimationFrame(() => detectLoop(onDetect))
  }, [applyBandPassWindow, findPeakFrequency])

  /**
   * Start listening for ultrasonic signals
   */
  const startListening = useCallback(async (onDetect) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,  // Disable - we want raw signal
          noiseSuppression: false,  // Disable - we handle our own filtering
          autoGainControl: false,   // Disable - we need consistent amplitude
          sampleRate: SAMPLE_RATE,
          channelCount: 1
        }
      })
      setPermission('granted')
      streamRef.current = stream

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: SAMPLE_RATE
      })
      audioCtxRef.current = audioCtx

      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.4  // Some smoothing for stability
      analyser.minDecibels = -100
      analyser.maxDecibels = -10
      analyserRef.current = analyser

      const source = audioCtx.createMediaStreamSource(stream)
      sourceRef.current = source

      // High-pass filter to attenuate low frequencies before analysis
      const highPass = audioCtx.createBiquadFilter()
      highPass.type = 'highpass'
      highPass.frequency.value = 15000  // Only pass 15kHz+
      highPass.Q.value = 0.5

      source.connect(highPass)
      highPass.connect(analyser)

      onDetectRef.current = onDetect
      noiseFramesRef.current = []
      confirmationRef.current = { freq: null, count: 0 }

      setIsListening(true)
      setStatus('calibrating')
      setDetectedFrequency(null)
      setSignalStrength(0)

      detectLoop(onDetect)
    } catch (err) {
      setPermission('denied')
      setStatus('error')
      console.error('Microphone error:', err)
      throw err
    }
  }, [detectLoop])

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (audioCtxRef.current) audioCtxRef.current.close()
    audioCtxRef.current = null
    analyserRef.current = null
    sourceRef.current = null
    streamRef.current = null
    noiseFramesRef.current = []
    confirmationRef.current = { freq: null, count: 0 }
    setIsListening(false)
    setStatus('idle')
    setDetectedFrequency(null)
    setSignalStrength(0)
  }, [])

  return {
    isListening,
    detectedFrequency,
    signalStrength,
    status,
    noiseFloor,
    permission,
    startListening,
    stopListening
  }
}

/**
 * useUltrasonicEmitter
 * Generates ultrasonic tones using Web Audio API OscillatorNode
 * Supports multi-frequency encoding for session data
 */
export const useUltrasonicEmitter = () => {
  const audioCtxRef = useRef(null)
  const oscillatorsRef = useRef([])
  const [isEmitting, setIsEmitting] = useState(false)
  const [currentFrequency, setCurrentFrequency] = useState(null)

  const startEmitting = useCallback((frequency, additionalFreqs = []) => {
    stopEmitting()

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    audioCtxRef.current = audioCtx

    const allFreqs = [frequency, ...additionalFreqs].slice(0, 4) // Max 4 simultaneous
    const gainNode = audioCtx.createGain()
    gainNode.gain.value = 0.3  // Keep volume reasonable
    gainNode.connect(audioCtx.destination)

    allFreqs.forEach((freq) => {
      const osc = audioCtx.createOscillator()
      osc.type = 'sine'  // Sine wave for cleanest ultrasonic
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime)
      
      const oscGain = audioCtx.createGain()
      oscGain.gain.value = 1 / allFreqs.length  // Equal amplitude per freq
      
      osc.connect(oscGain)
      oscGain.connect(gainNode)
      osc.start()
      oscillatorsRef.current.push(osc)
    })

    setIsEmitting(true)
    setCurrentFrequency(frequency)
    console.log(`Emitting ultrasonic at ${frequency}Hz (${allFreqs.length} freqs)`)
  }, [])

  const stopEmitting = useCallback(() => {
    oscillatorsRef.current.forEach(osc => { try { osc.stop() } catch(e) {} })
    oscillatorsRef.current = []
    if (audioCtxRef.current) audioCtxRef.current.close()
    audioCtxRef.current = null
    setIsEmitting(false)
    setCurrentFrequency(null)
  }, [])

  const updateFrequency = useCallback((newFreq) => {
    oscillatorsRef.current.forEach(osc => {
      osc.frequency.setValueAtTime(newFreq, audioCtxRef.current?.currentTime || 0)
    })
    setCurrentFrequency(newFreq)
  }, [])

  return { isEmitting, currentFrequency, startEmitting, stopEmitting, updateFrequency }
}
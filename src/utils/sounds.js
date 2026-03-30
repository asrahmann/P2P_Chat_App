// Web Audio API sound generator — no external audio files needed

const audioCtx = new (window.AudioContext || window.webkitAudioContext)()

function ensureContext() {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
}

function playTone(frequency, duration, type = 'sine', volume = 0.15) {
  ensureContext()
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, audioCtx.currentTime)
  gain.gain.setValueAtTime(volume, audioCtx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start()
  osc.stop(audioCtx.currentTime + duration)
}

export function playMessageSound() {
  // Discord-like "pop" — two quick notes
  playTone(800, 0.08, 'sine', 0.12)
  setTimeout(() => playTone(1000, 0.1, 'sine', 0.1), 50)
}

export function playJoinSound() {
  // Rising two-tone chime
  playTone(523, 0.15, 'sine', 0.1)
  setTimeout(() => playTone(659, 0.2, 'sine', 0.1), 120)
}

export function playLeaveSound() {
  // Falling two-tone
  playTone(659, 0.15, 'sine', 0.1)
  setTimeout(() => playTone(440, 0.2, 'sine', 0.1), 120)
}

export function playMentionSound() {
  // Three-tone alert for @mentions
  playTone(880, 0.1, 'sine', 0.15)
  setTimeout(() => playTone(1100, 0.1, 'sine', 0.15), 100)
  setTimeout(() => playTone(1320, 0.15, 'sine', 0.12), 200)
}

import { useState, useEffect, useRef, useCallback } from 'react'

export function useVoice(roomRef, peers) {
  const [isMuted, setIsMuted] = useState(true)
  const [activeSpeakers, setActiveSpeakers] = useState(new Set())
  const streamRef = useRef(null)
  const audioElementsRef = useRef(new Map())
  const analyserIntervalRef = useRef(null)

  // Set up receiving peer audio streams
  useEffect(() => {
    const room = roomRef.current
    if (!room) return

    room.onPeerStream((stream, peerId) => {
      // Create or reuse audio element for this peer
      let audio = audioElementsRef.current.get(peerId)
      if (!audio) {
        audio = new Audio()
        audio.autoplay = true
        audioElementsRef.current.set(peerId, audio)
      }
      audio.srcObject = stream
    })

    room.onPeerLeave?.((peerId) => {
      const audio = audioElementsRef.current.get(peerId)
      if (audio) {
        audio.srcObject = null
        audioElementsRef.current.delete(peerId)
      }
      setActiveSpeakers((prev) => {
        const next = new Set(prev)
        next.delete(peerId)
        return next
      })
    })

    return () => {
      audioElementsRef.current.forEach((audio) => {
        audio.srcObject = null
      })
      audioElementsRef.current.clear()
    }
  }, [roomRef, peers])

  const toggleMute = useCallback(async () => {
    const room = roomRef.current
    if (!room) return

    if (isMuted) {
      // Unmute — get mic and share stream
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        })
        streamRef.current = stream
        room.addStream(stream)
        setIsMuted(false)

        // Start voice activity detection
        const audioCtx = new AudioContext()
        const analyser = audioCtx.createAnalyser()
        const source = audioCtx.createMediaStreamSource(stream)
        source.connect(analyser)
        analyser.fftSize = 512
        const dataArray = new Uint8Array(analyser.frequencyBinCount)

        analyserIntervalRef.current = setInterval(() => {
          analyser.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          setActiveSpeakers((prev) => {
            const next = new Set(prev)
            if (average > 15) {
              next.add('self')
            } else {
              next.delete('self')
            }
            return next
          })
        }, 100)
      } catch (err) {
        console.error('Microphone access denied:', err)
      }
    } else {
      // Mute — stop stream
      if (streamRef.current) {
        const room = roomRef.current
        if (room) room.removeStream(streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (analyserIntervalRef.current) {
        clearInterval(analyserIntervalRef.current)
        analyserIntervalRef.current = null
      }
      setActiveSpeakers((prev) => {
        const next = new Set(prev)
        next.delete('self')
        return next
      })
      setIsMuted(true)
    }
  }, [isMuted, roomRef])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (analyserIntervalRef.current) {
        clearInterval(analyserIntervalRef.current)
      }
      audioElementsRef.current.forEach((audio) => {
        audio.srcObject = null
      })
    }
  }, [])

  return { isMuted, activeSpeakers, toggleMute }
}

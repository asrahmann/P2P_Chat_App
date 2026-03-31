import { useState, useEffect, useRef, useCallback } from 'react'
import { joinRoom, selfId } from 'trystero'

const APP_ID = 'shade404-chat-v1'
const TYPING_TIMEOUT = 3000

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunks = []
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)))
  }
  return btoa(chunks.join(''))
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function useRoom(roomCode, nickname, userColor) {
  const [messages, setMessages] = useState([])
  const [peers, setPeers] = useState(new Map())
  const [connected, setConnected] = useState(false)
  const [typingPeers, setTypingPeers] = useState(new Map())
  const roomRef = useRef(null)
  const sendMsgRef = useRef(null)
  const sendFileRef = useRef(null)
  const sendMetaRef = useRef(null)
  const sendTypingRef = useRef(null)
  const sendColorRef = useRef(null)
  const userColorRef = useRef(userColor)
  const typingTimersRef = useRef(new Map())
  const blobUrlsRef = useRef([])
  const onMessageCallbackRef = useRef(null)
  const onJoinCallbackRef = useRef(null)
  const onLeaveCallbackRef = useRef(null)

  useEffect(() => {
    userColorRef.current = userColor
  }, [userColor])

  useEffect(() => {
    if (!roomCode || !nickname) return

    const room = joinRoom({ appId: APP_ID }, roomCode)
    roomRef.current = room

    const [sendMsg, onMsg] = room.makeAction('message')
    const [sendFile, onFile] = room.makeAction('file')
    const [sendMeta, onMeta] = room.makeAction('meta')
    const [sendTyping, onTyping] = room.makeAction('typing')
    const [sendColor, onColor] = room.makeAction('color')

    sendMsgRef.current = sendMsg
    sendFileRef.current = sendFile
    sendMetaRef.current = sendMeta
    sendTypingRef.current = sendTyping
    sendColorRef.current = sendColor

    room.onPeerJoin((peerId) => {
      setPeers((prev) => new Map(prev).set(peerId, { nickname: peerId.slice(0, 6) }))
      setConnected(true)
      sendMeta({ nickname, color: userColorRef.current }, peerId)
    })

    room.onPeerLeave((peerId) => {
      setPeers((prev) => {
        const next = new Map(prev)
        const peer = next.get(peerId)
        next.delete(peerId)

        if (peer) {
          setMessages((msgs) => [
            ...msgs,
            {
              id: crypto.randomUUID(),
              type: 'system',
              text: `${peer.nickname} left the chat`,
              timestamp: Date.now(),
            },
          ])
          onLeaveCallbackRef.current?.(peer.nickname)
        }

        return next
      })

      // Clear typing state for departed peer
      setTypingPeers((prev) => {
        const next = new Map(prev)
        next.delete(peerId)
        return next
      })
    })

    onMeta((data, peerId) => {
      setPeers((prev) => {
        const next = new Map(prev)
        const isNew = !next.has(peerId) || next.get(peerId).nickname === peerId.slice(0, 6)
        next.set(peerId, { nickname: data.nickname, color: data.color || null })

        if (isNew) {
          setMessages((msgs) => [
            ...msgs,
            {
              id: crypto.randomUUID(),
              type: 'system',
              text: `${data.nickname} joined the chat`,
              timestamp: Date.now(),
            },
          ])
          onJoinCallbackRef.current?.(data.nickname)
        }

        return next
      })
    })

    onMsg((data, peerId) => {
      setMessages((msgs) => [
        ...msgs,
        {
          id: data.id || crypto.randomUUID(),
          type: 'text',
          text: data.text,
          sender: data.sender,
          peerId,
          timestamp: data.timestamp || Date.now(),
        },
      ])
      // Clear typing when message received from this peer
      setTypingPeers((prev) => {
        const next = new Map(prev)
        next.delete(peerId)
        return next
      })
      onMessageCallbackRef.current?.(data.sender, peerId)
    })

    onFile((data, peerId) => {
      const buffer = base64ToArrayBuffer(data.data)
      const blob = new Blob([buffer], { type: data.mimeType })
      const url = URL.createObjectURL(blob)
      blobUrlsRef.current.push(url)
      const isAudio = data.mimeType.startsWith('audio/')
      setMessages((msgs) => [
        ...msgs,
        {
          id: data.id || crypto.randomUUID(),
          type: isAudio ? 'audio' : 'image',
          ...(isAudio ? { audioUrl: url } : { imageUrl: url }),
          fileName: data.fileName,
          sender: data.sender,
          peerId,
          timestamp: data.timestamp || Date.now(),
        },
      ])
      onMessageCallbackRef.current?.(data.sender, peerId)
    })

    onTyping((data, peerId) => {
      if (!data.typing) {
        setTypingPeers((prev) => {
          const next = new Map(prev)
          next.delete(peerId)
          return next
        })
        return
      }

      setTypingPeers((prev) => new Map(prev).set(peerId, data.nickname))

      // Auto-clear after timeout
      const existing = typingTimersRef.current.get(peerId)
      if (existing) clearTimeout(existing)
      typingTimersRef.current.set(
        peerId,
        setTimeout(() => {
          setTypingPeers((prev) => {
            const next = new Map(prev)
            next.delete(peerId)
            return next
          })
          typingTimersRef.current.delete(peerId)
        }, TYPING_TIMEOUT)
      )
    })

    onColor((data, peerId) => {
      setPeers((prev) => {
        const next = new Map(prev)
        const existing = next.get(peerId)
        if (existing) {
          next.set(peerId, { ...existing, color: data.color })
        }
        return next
      })
    })

    setConnected(true)

    return () => {
      room.leave()
      roomRef.current = null
      typingTimersRef.current.forEach((timer) => clearTimeout(timer))
      typingTimersRef.current.clear()
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      blobUrlsRef.current = []
    }
  }, [roomCode, nickname])

  const sendMessage = useCallback(
    (text) => {
      if (!sendMsgRef.current) return
      const msg = {
        id: crypto.randomUUID(),
        text,
        sender: nickname,
        timestamp: Date.now(),
      }
      sendMsgRef.current(msg)
      setMessages((msgs) => [...msgs, { ...msg, type: 'text', peerId: 'self' }])
      // Stop typing indicator when we send
      sendTypingRef.current?.({ typing: false, nickname })
      return msg
    },
    [nickname]
  )

  const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB

  const sendFile = useCallback(
    async (file) => {
      if (!sendFileRef.current) return
      if (file.size > MAX_FILE_SIZE) {
        setMessages((msgs) => [
          ...msgs,
          {
            id: crypto.randomUUID(),
            type: 'system',
            text: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max size is 100 MB.`,
            timestamp: Date.now(),
          },
        ])
        return
      }
      const buffer = await file.arrayBuffer()
      const data = {
        id: crypto.randomUUID(),
        data: arrayBufferToBase64(buffer),
        mimeType: file.type,
        fileName: file.name,
        sender: nickname,
        timestamp: Date.now(),
      }
      sendFileRef.current(data)

      const url = URL.createObjectURL(file)
      blobUrlsRef.current.push(url)
      const isAudio = file.type.startsWith('audio/')
      setMessages((msgs) => [
        ...msgs,
        {
          id: data.id,
          type: isAudio ? 'audio' : 'image',
          ...(isAudio ? { audioUrl: url } : { imageUrl: url }),
          fileName: file.name,
          sender: nickname,
          peerId: 'self',
          timestamp: data.timestamp,
        },
      ])
    },
    [nickname]
  )

  const sendTypingIndicator = useCallback(
    (isTyping) => {
      sendTypingRef.current?.({ typing: isTyping, nickname })
    },
    [nickname]
  )

  const sendColorChange = useCallback((color) => {
    sendColorRef.current?.({ color })
  }, [])

  const addLocalMessage = useCallback((msg) => {
    setMessages((msgs) => [...msgs, msg])
  }, [])

  // Callbacks for sound notifications
  const onMessage = useCallback((cb) => {
    onMessageCallbackRef.current = cb
  }, [])
  const onJoin = useCallback((cb) => {
    onJoinCallbackRef.current = cb
  }, [])
  const onLeave = useCallback((cb) => {
    onLeaveCallbackRef.current = cb
  }, [])

  return {
    messages,
    peers,
    connected,
    typingPeers,
    sendMessage,
    sendFile,
    sendTypingIndicator,
    sendColorChange,
    addLocalMessage,
    selfId,
    room: roomRef,
    onMessage,
    onJoin,
    onLeave,
  }
}

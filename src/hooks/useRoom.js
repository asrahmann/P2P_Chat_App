import { useState, useEffect, useRef, useCallback } from 'react'
import { joinRoom, selfId } from 'trystero'

const APP_ID = 'shade404-chat-v1'
const TYPING_TIMEOUT = 3000

export function useRoom(roomCode, nickname) {
  const [messages, setMessages] = useState([])
  const [peers, setPeers] = useState(new Map())
  const [connected, setConnected] = useState(false)
  const [typingPeers, setTypingPeers] = useState(new Map())
  const roomRef = useRef(null)
  const sendMsgRef = useRef(null)
  const sendImgRef = useRef(null)
  const sendMetaRef = useRef(null)
  const sendTypingRef = useRef(null)
  const typingTimersRef = useRef(new Map())
  const blobUrlsRef = useRef([])
  const onMessageCallbackRef = useRef(null)
  const onJoinCallbackRef = useRef(null)
  const onLeaveCallbackRef = useRef(null)

  useEffect(() => {
    if (!roomCode || !nickname) return

    const room = joinRoom({ appId: APP_ID }, roomCode)
    roomRef.current = room

    const [sendMsg, onMsg] = room.makeAction('message')
    const [sendImg, onImg] = room.makeAction('image')
    const [sendMeta, onMeta] = room.makeAction('meta')
    const [sendTyping, onTyping] = room.makeAction('typing')

    sendMsgRef.current = sendMsg
    sendImgRef.current = sendImg
    sendMetaRef.current = sendMeta
    sendTypingRef.current = sendTyping

    room.onPeerJoin((peerId) => {
      setPeers((prev) => new Map(prev).set(peerId, { nickname: peerId.slice(0, 6) }))
      setConnected(true)
      sendMeta({ nickname }, peerId)
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
        next.set(peerId, { nickname: data.nickname })

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
      onMessageCallbackRef.current?.(data.sender)
    })

    onImg((data, peerId) => {
      const blob = new Blob([data.data], { type: data.mimeType })
      const url = URL.createObjectURL(blob)
      blobUrlsRef.current.push(url)
      setMessages((msgs) => [
        ...msgs,
        {
          id: data.id || crypto.randomUUID(),
          type: 'image',
          imageUrl: url,
          fileName: data.fileName,
          sender: data.sender,
          peerId,
          timestamp: data.timestamp || Date.now(),
        },
      ])
      onMessageCallbackRef.current?.(data.sender)
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

  const sendImage = useCallback(
    async (file) => {
      if (!sendImgRef.current) return
      const buffer = await file.arrayBuffer()
      const data = {
        id: crypto.randomUUID(),
        data: buffer,
        mimeType: file.type,
        fileName: file.name,
        sender: nickname,
        timestamp: Date.now(),
      }
      sendImgRef.current(data)

      const url = URL.createObjectURL(file)
      blobUrlsRef.current.push(url)
      setMessages((msgs) => [
        ...msgs,
        {
          id: data.id,
          type: 'image',
          imageUrl: url,
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
    sendImage,
    sendTypingIndicator,
    addLocalMessage,
    selfId,
    room: roomRef,
    onMessage,
    onJoin,
    onLeave,
  }
}

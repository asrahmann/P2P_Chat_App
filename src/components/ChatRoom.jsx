import { useState, useRef, useEffect, useMemo } from 'react'
import EmojiPicker from 'emoji-picker-react'
import { useRoom } from '../hooks/useRoom'
import { useVoice } from '../hooks/useVoice'
import { playMessageSound, playJoinSound, playLeaveSound } from '../utils/sounds'
import NetworkMap from './NetworkMap'

const CIPHER_CHARS = '0123456789ABCDEFabcdef@#$%&*!?<>{}[]=/|~ァイウエオカキクケコサシスセソタチツテト░▒▓█'

function DecodingText({ text }) {
  const [display, setDisplay] = useState(() => {
    const chars = [...text]
    return chars.map(c => c === ' ' ? ' ' : CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)]).join('')
  })

  useEffect(() => {
    const chars = [...text]
    const len = chars.length
    if (len === 0) return
    const totalFrames = Math.max(20, Math.min(len * 3, 60))
    let frame = 0

    const interval = setInterval(() => {
      frame++
      const revealCount = Math.floor((frame / totalFrames) * len)

      if (revealCount >= len) {
        setDisplay(text)
        clearInterval(interval)
        return
      }

      setDisplay(chars.map((c, i) => {
        if (i < revealCount) return c
        if (c === ' ') return ' '
        return CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)]
      }).join(''))
    }, 30)

    return () => clearInterval(interval)
  }, [text])

  return display
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const COLOR_PALETTE = [
  '#E91E63', '#F44336', '#FF5722', '#FF9800', '#FFC107',
  '#FFEB3B', '#CDDC39', '#8BC34A', '#4CAF50', '#009688',
  '#00BCD4', '#03A9F4', '#2196F3', '#3F51B5', '#673AB7',
  '#9C27B0', '#E040FB', '#FF4081', '#FF6E40', '#FFD740',
  '#69F0AE', '#40C4FF', '#7C4DFF', '#536DFE', '#448AFF',
  '#18FFFF', '#64FFDA', '#B2FF59', '#EEFF41', '#FFD180',
  '#FF9E80', '#EA80FC', '#B388FF', '#8C9EFF', '#82B1FF',
  '#80D8FF', '#84FFFF', '#A7FFEB', '#CCFF90', '#F4FF81',
  '#FFE57F', '#FFD54F', '#FFB74D', '#FF8A65', '#A1887F',
  '#90A4AE', '#5865F2', '#57F287', '#EB459E', '#ED4245',
]

function getDefaultColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length]
}

function MessageItem({ msg, prevMsg, getColor, onNameClick }) {
  if (msg.type === 'system') {
    return (
      <div className="message-system">
        <span>{msg.text}</span>
      </div>
    )
  }

  if (msg.type === 'thinking') {
    return (
      <div className="message-group">
        <div className="avatar" style={{ background: '#5865F2' }}>AI</div>
        <div className="message-content">
          <div className="message-header">
            <span className="message-author" style={{ color: '#5865F2' }}>AI</span>
            <span className="message-time">{formatTime(msg.timestamp)}</span>
          </div>
          <div className="message-text thinking-dots">
            <span>●</span><span>●</span><span>●</span>
          </div>
        </div>
      </div>
    )
  }

  const isAI = msg.sender === 'AI'
  const isSameAuthor =
    prevMsg &&
    prevMsg.type !== 'system' &&
    prevMsg.type !== 'thinking' &&
    prevMsg.sender === msg.sender &&
    msg.timestamp - prevMsg.timestamp < 300000

  if (isSameAuthor) {
    return (
      <div className="message-continuation">
        <span className="message-time-inline">{formatTime(msg.timestamp)}</span>
        {msg.type === 'image' ? (
          <div className="message-image">
            <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer"><img src={msg.imageUrl} alt={msg.fileName || 'shared image'} /></a>
          </div>
        ) : msg.type === 'audio' ? (
          <div className="message-audio">
            <span className="audio-file-name">{msg.fileName || 'audio'}</span>
            <audio controls preload="metadata" src={msg.audioUrl} />
          </div>
        ) : (
          <div className="message-text">
            <DecodingText text={msg.text} />
          </div>
        )}
      </div>
    )
  }

  const color = isAI ? '#5865F2' : getColor(msg.peerId, msg.sender)

  return (
    <div className="message-group">
      <div className="avatar" style={{ background: color }}>
        {isAI ? 'AI' : msg.sender.slice(0, 2).toUpperCase()}
      </div>
      <div className="message-content">
        <div className="message-header">
          <span
            className={`message-author ${!isAI && msg.peerId === 'self' ? 'message-author-clickable' : ''}`}
            style={{ color }}
            onClick={!isAI && msg.peerId === 'self' ? onNameClick : undefined}
          >{msg.sender}</span>
          <span className="message-time">{formatTime(msg.timestamp)}</span>
        </div>
        {msg.type === 'image' ? (
          <div className="message-image">
            <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer"><img src={msg.imageUrl} alt={msg.fileName || 'shared image'} /></a>
          </div>
        ) : msg.type === 'audio' ? (
          <div className="message-audio">
            <span className="audio-file-name">{msg.fileName || 'audio'}</span>
            <audio controls preload="metadata" src={msg.audioUrl} />
          </div>
        ) : (
          <div className="message-text">
            <DecodingText text={msg.text} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatRoom({ roomCode, nickname, onLeave }) {
  const [input, setInput] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [lastActivity, setLastActivity] = useState(null)
  const [userColor, setUserColor] = useState(() => {
    return localStorage.getItem('shade404-user-color') || getDefaultColor(nickname)
  })
  const messagesEndRef = useRef(null)
  const containerRef = useRef(null)
  const isAtBottomRef = useRef(true)
  const fileInputRef = useRef(null)
  const emojiRef = useRef(null)
  const colorPickerRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  const {
    messages: rawMessages,
    peers,
    typingPeers,
    sendMessage,
    sendFile,
    sendTypingIndicator,
    sendColorChange,
    addLocalMessage,
    room,
    onMessage,
    onJoin,
    onLeave: onPeerLeave,
  } = useRoom(roomCode, nickname, userColor)

  const { isMuted, activeSpeakers, toggleMute } = useVoice(room, peers)

  // Handle replace messages (thinking -> response)
  const messages = useMemo(() => {
    const result = []
    for (const msg of rawMessages) {
      if (msg.type === 'replace') {
        const idx = result.findIndex((m) => m.id === msg.replaceId)
        if (idx !== -1) result[idx] = msg.replacement
      } else {
        result.push(msg)
      }
    }
    return result
  }, [rawMessages])

  // Register sound callbacks + activity tracking
  useEffect(() => {
    onMessage((_sender, peerId) => {
      playMessageSound()
      setLastActivity({ peerId, timestamp: Date.now() })
    })
    onJoin(() => playJoinSound())
    onPeerLeave(() => playLeaveSound())
  }, [onMessage, onJoin, onPeerLeave])

  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }

  // Close emoji picker on outside click
  useEffect(() => {
    function handleClick(e) {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setEmojiOpen(false)
      }
    }
    if (emojiOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [emojiOpen])

  // Close color picker on outside click
  useEffect(() => {
    function handleClick(e) {
      if (e.target.closest('.message-author-clickable')) return
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setColorPickerOpen(false)
      }
    }
    if (colorPickerOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [colorPickerOpen])

  function handleColorSelect(color) {
    setUserColor(color)
    localStorage.setItem('shade404-user-color', color)
    sendColorChange(color)
    setColorPickerOpen(false)
  }

  function getColor(peerId, senderName) {
    if (peerId === 'self') return userColor
    const peer = peers.get(peerId)
    return peer?.color || getDefaultColor(senderName)
  }

  function handleInputChange(e) {
    setInput(e.target.value)

    // Send typing indicator
    if (e.target.value.trim()) {
      sendTypingIndicator(true)
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator(false)
      }, 2000)
    } else {
      sendTypingIndicator(false)
      clearTimeout(typingTimeoutRef.current)
    }
  }

  function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    clearTimeout(typingTimeoutRef.current)

    sendMessage(text)
    setLastActivity({ peerId: 'self', timestamp: Date.now() })
  }

  function handleEmojiSelect(emojiData) {
    setInput((prev) => prev + emojiData.emoji)
    setEmojiOpen(false)
  }

  function showError(text) {
    addLocalMessage({
      id: crypto.randomUUID(),
      type: 'system',
      text,
      timestamp: Date.now(),
    })
  }

  function tryShareFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/') && !file.type.startsWith('audio/')) {
      const ext = file.name.split('.').pop() || file.type || 'unknown'
      showError(`Can't share .${ext} files. Only images and audio files are supported.`)
      return
    }
    sendFile(file)
    setLastActivity({ peerId: 'self', timestamp: Date.now() })
  }

  function handleFileSelect(e) {
    tryShareFile(e.target.files?.[0])
    e.target.value = ''
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) sendFile(file)
        return
      }
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file) tryShareFile(file)
  }

  function copyInvite() {
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const peerCount = peers.size
  const typingNames = [...typingPeers.values()]

  let typingText = ''
  if (typingNames.length === 1) {
    typingText = `${typingNames[0]} is typing...`
  } else if (typingNames.length === 2) {
    typingText = `${typingNames[0]} and ${typingNames[1]} are typing...`
  } else if (typingNames.length > 2) {
    typingText = `${typingNames.length} people are typing...`
  }

  return (
    <div
      className="chat-layout"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Cracked glass overlay */}
      <div className="crack-overlay">
        <svg viewBox="0 0 1920 1080" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          {/* Impact point — upper right area */}
          <circle cx="1380" cy="220" r="3" fill="rgba(0,255,200,0.12)" />
          {/* Main radial cracks from impact */}
          <g stroke="rgba(0,255,200,0.07)" strokeWidth="0.8" fill="none">
            <path d="M1380 220 L1520 80" />
            <path d="M1380 220 L1600 180" />
            <path d="M1380 220 L1480 350" />
            <path d="M1380 220 L1250 120" />
            <path d="M1380 220 L1200 280" />
            <path d="M1380 220 L1350 400" />
            <path d="M1380 220 L1550 320" />
            <path d="M1380 220 L1420 50" />
          </g>
          {/* Secondary branches */}
          <g stroke="rgba(0,255,200,0.05)" strokeWidth="0.5" fill="none">
            <path d="M1520 80 L1580 20" />
            <path d="M1520 80 L1620 110" />
            <path d="M1600 180 L1700 150" />
            <path d="M1600 180 L1650 250" />
            <path d="M1480 350 L1520 450" />
            <path d="M1480 350 L1560 380" />
            <path d="M1250 120 L1150 60" />
            <path d="M1250 120 L1180 180" />
            <path d="M1200 280 L1080 320" />
            <path d="M1200 280 L1150 220" />
            <path d="M1350 400 L1300 500" />
            <path d="M1350 400 L1420 480" />
            <path d="M1550 320 L1650 360" />
            <path d="M1420 50 L1380 0" />
            <path d="M1420 50 L1500 10" />
          </g>
          {/* Tertiary fine cracks */}
          <g stroke="rgba(0,255,200,0.03)" strokeWidth="0.3" fill="none">
            <path d="M1580 20 L1620 0" />
            <path d="M1620 110 L1700 90" />
            <path d="M1700 150 L1780 130" />
            <path d="M1650 250 L1720 280" />
            <path d="M1520 450 L1500 520" />
            <path d="M1560 380 L1630 420" />
            <path d="M1150 60 L1100 20" />
            <path d="M1180 180 L1100 200" />
            <path d="M1080 320 L1000 360" />
            <path d="M1300 500 L1250 560" />
            <path d="M1420 480 L1460 540" />
            <path d="M1650 360 L1720 400" />
          </g>
          {/* Concentric stress rings around impact */}
          <circle cx="1380" cy="220" r="40" stroke="rgba(0,255,200,0.04)" strokeWidth="0.4" fill="none" />
          <circle cx="1380" cy="220" r="90" stroke="rgba(0,255,200,0.03)" strokeWidth="0.3" fill="none" />
          <circle cx="1380" cy="220" r="160" stroke="rgba(0,255,200,0.02)" strokeWidth="0.3" fill="none" />
          {/* Second smaller impact — lower left */}
          <circle cx="320" cy="780" r="2" fill="rgba(255,0,255,0.08)" />
          <g stroke="rgba(255,0,255,0.04)" strokeWidth="0.5" fill="none">
            <path d="M320 780 L200 700" />
            <path d="M320 780 L420 680" />
            <path d="M320 780 L250 880" />
            <path d="M320 780 L430 850" />
            <path d="M320 780 L180 820" />
          </g>
          <g stroke="rgba(255,0,255,0.025)" strokeWidth="0.3" fill="none">
            <path d="M200 700 L140 650" />
            <path d="M420 680 L480 620" />
            <path d="M250 880 L200 950" />
            <path d="M430 850 L500 900" />
            <path d="M180 820 L100 860" />
          </g>
          <circle cx="320" cy="780" r="50" stroke="rgba(255,0,255,0.025)" strokeWidth="0.3" fill="none" />
        </svg>
      </div>

      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Shade404 // Network</h2>
        </div>

        <div className="room-info">
          <div className="room-code-display">
            <span className="room-code-label">Room</span>
            <span className="room-code-value">{roomCode}</span>
          </div>
          <button className="btn-small" onClick={copyInvite}>
            {copied ? 'Copied!' : 'Copy Room Code'}
          </button>
        </div>

        {/* Voice Section */}
        <div className="voice-section">
          <button
            className={`voice-btn ${isMuted ? '' : 'voice-active'}`}
            onClick={toggleMute}
          >
            {isMuted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            )}
            <span>{isMuted ? 'Open Mic' : 'Kill Mic'}</span>
          </button>
        </div>

        <div className="members-section">
          <h3>Active Nodes — {peerCount + 1}</h3>
          <div className="member-list">
            <div className={`member ${activeSpeakers.has('self') ? 'member-speaking' : ''}`} ref={colorPickerRef}>
              <div className="member-dot" style={{ background: userColor }} />
              <span
                className="member-name-clickable"
                style={{ color: userColor }}
                onClick={() => setColorPickerOpen(!colorPickerOpen)}
                title="Change your color"
              >
                {nickname} (you)
              </span>
              {!isMuted && (
                <span className="member-voice-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  </svg>
                </span>
              )}
              {colorPickerOpen && (
                <div className="color-picker-popup">
                  <div className="color-picker-label">Pick your color</div>
                  <div className="color-picker-grid">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c}
                        className={`color-swatch ${c === userColor ? 'color-swatch-active' : ''}`}
                        style={{ background: c }}
                        onClick={() => handleColorSelect(c)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            {[...peers.entries()].map(([id, peer]) => (
              <div key={id} className={`member ${activeSpeakers.has(id) ? 'member-speaking' : ''}`}>
                <div className="member-dot" style={{ background: peer.color || getDefaultColor(peer.nickname) }} />
                <span style={{ color: peer.color || getDefaultColor(peer.nickname) }}>{peer.nickname}</span>
              </div>
            ))}
          </div>
        </div>

        <NetworkMap
          peers={peers}
          nickname={nickname}
          userColor={userColor}
          getDefaultColor={getDefaultColor}
          lastActivity={lastActivity}
        />

        <div className="sidebar-footer">
          <button className="btn-icon btn-leave" onClick={onLeave} title="Leave Room">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 4.5A1.5 1.5 0 014.5 3h5A1.5 1.5 0 0111 4.5v1a.5.5 0 01-1 0v-1a.5.5 0 00-.5-.5h-5a.5.5 0 00-.5.5v11a.5.5 0 00.5.5h5a.5.5 0 00.5-.5v-1a.5.5 0 011 0v1a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 013 15.5v-11z" />
              <path d="M14.854 10.354a.5.5 0 000-.708l-3-3a.5.5 0 10-.708.708L13.293 9.5H6.5a.5.5 0 000 1h6.793l-2.147 2.146a.5.5 0 00.708.708l3-3z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        <div className="chat-header">
          <span className="chat-header-hash">//</span>
          <span className="chat-header-name">Chatroom</span>
          <span className="chat-header-divider" />
          <span className="chat-header-topic">
            P2P encrypted // no servers // no logs
          </span>
        </div>

        <div className="messages-container" ref={containerRef} onScroll={handleScroll}>
          <div className="messages-start">
            <h2>// Node Connected: {roomCode}</h2>
            <p>
              Encrypted tunnel established. Share the room code to
              link more nodes to this network.
            </p>
          </div>

          {messages.map((msg, i) => (
            <MessageItem key={msg.id} msg={msg} prevMsg={messages[i - 1]} getColor={getColor} onNameClick={() => setColorPickerOpen(true)} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator — always reserve space to prevent layout shift */}
        <div className="typing-indicator">
          {typingText && (
            <>
              <div className="typing-dots">
                <span /><span /><span />
              </div>
              <span className="typing-text">{typingText}</span>
            </>
          )}
        </div>

        <form className="chat-input-bar" onSubmit={handleSend}>
          <button
            type="button"
            className="btn-icon input-action"
            onClick={() => fileInputRef.current?.click()}
            title="Upload file"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*"
            hidden
            onChange={handleFileSelect}
          />

          <div className="emoji-wrapper" ref={emojiRef}>
            <button
              type="button"
              className="btn-icon input-action"
              onClick={() => setEmojiOpen(!emojiOpen)}
              title="Emoji"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2.5-6.5c-.28 0-.5.22-.5.5s.22.5.5.5h5c.28 0 .5-.22.5-.5s-.22-.5-.5-.5h-5zM8.5 11c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm7 0c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5z" />
              </svg>
            </button>
            {emojiOpen && (
              <div className="emoji-picker-container">
                <EmojiPicker
                  onEmojiClick={handleEmojiSelect}
                  theme="dark"
                  width={320}
                  height={400}
                  searchPlaceholder="Search emoji..."
                  previewConfig={{ showPreview: false }}
                />
              </div>
            )}
          </div>

          <input
            type="text"
            className="chat-text-input"
            placeholder={`input> _`}
            value={input}
            onChange={handleInputChange}
            onPaste={handlePaste}
          />
          <button type="submit" className="btn-icon input-action" disabled={!input.trim()}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </div>

    </div>
  )
}

import { useState, useRef, useEffect, useCallback } from 'react'
import EmojiPicker from 'emoji-picker-react'
import { useRoom } from '../hooks/useRoom'
import { useVoice } from '../hooks/useVoice'
import { playMessageSound, playJoinSound, playLeaveSound } from '../utils/sounds'

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getAvatarColor(name) {
  const colors = [
    '#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245',
    '#F47B67', '#E78FCF', '#9B84EE', '#45DDC0', '#F0B232',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function MessageItem({ msg, prevMsg }) {
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
            <img src={msg.imageUrl} alt={msg.fileName || 'shared image'} />
          </div>
        ) : (
          <div className="message-text">{msg.text}</div>
        )}
      </div>
    )
  }

  const color = isAI ? '#5865F2' : getAvatarColor(msg.sender)

  return (
    <div className="message-group">
      <div className="avatar" style={{ background: color }}>
        {isAI ? 'AI' : msg.sender.slice(0, 2).toUpperCase()}
      </div>
      <div className="message-content">
        <div className="message-header">
          <span className="message-author" style={{ color }}>{msg.sender}</span>
          <span className="message-time">{formatTime(msg.timestamp)}</span>
        </div>
        {msg.type === 'image' ? (
          <div className="message-image">
            <img src={msg.imageUrl} alt={msg.fileName || 'shared image'} />
          </div>
        ) : (
          <div className="message-text">{msg.text}</div>
        )}
      </div>
    </div>
  )
}

export default function ChatRoom({ roomCode, nickname, onLeave }) {
  const [input, setInput] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const emojiRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  const {
    messages: rawMessages,
    peers,
    typingPeers,
    sendMessage,
    sendImage,
    sendTypingIndicator,
    room,
    onMessage,
    onJoin,
    onLeave: onPeerLeave,
  } = useRoom(roomCode, nickname)

  const { isMuted, activeSpeakers, toggleMute } = useVoice(room, peers)

  // Handle replace messages (thinking -> response)
  const messages = rawMessages.reduce((acc, msg) => {
    if (msg.type === 'replace') {
      return acc.map((m) => (m.id === msg.replaceId ? msg.replacement : m))
    }
    return [...acc, msg]
  }, [])

  // Register sound callbacks
  useEffect(() => {
    onMessage((sender) => {
      if (document.hidden) playMessageSound()
      else playMessageSound()
    })
    onJoin(() => playJoinSound())
    onPeerLeave(() => playLeaveSound())
  }, [onMessage, onJoin, onPeerLeave])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
  }

  function handleEmojiSelect(emojiData) {
    setInput((prev) => prev + emojiData.emoji)
    setEmojiOpen(false)
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      sendImage(file)
    }
    e.target.value = ''
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) sendImage(file)
        return
      }
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file && file.type.startsWith('image/')) {
      sendImage(file)
    }
  }

  function copyInvite() {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`
    navigator.clipboard.writeText(url)
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
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Shade404 Chat</h2>
        </div>

        <div className="room-info">
          <div className="room-code-display">
            <span className="room-code-label">Room</span>
            <span className="room-code-value">{roomCode}</span>
          </div>
          <button className="btn-small" onClick={copyInvite}>
            {copied ? 'Copied!' : 'Copy Invite Link'}
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
            <span>{isMuted ? 'Join Voice' : 'Leave Voice'}</span>
          </button>
        </div>

        <div className="members-section">
          <h3>Online — {peerCount + 1}</h3>
          <div className="member-list">
            <div className={`member ${activeSpeakers.has('self') ? 'member-speaking' : ''}`}>
              <div className="member-dot" style={{ background: '#57F287' }} />
              <span>{nickname} (you)</span>
              {!isMuted && (
                <span className="member-voice-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  </svg>
                </span>
              )}
            </div>
            {[...peers.entries()].map(([id, peer]) => (
              <div key={id} className={`member ${activeSpeakers.has(id) ? 'member-speaking' : ''}`}>
                <div className="member-dot" style={{ background: '#57F287' }} />
                <span>{peer.nickname}</span>
              </div>
            ))}
          </div>
        </div>

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
          <span className="chat-header-hash">#</span>
          <span className="chat-header-name">general</span>
          <span className="chat-header-divider" />
          <span className="chat-header-topic">
            Peer-to-peer encrypted chat
          </span>
        </div>

        <div className="messages-container">
          <div className="messages-start">
            <div className="welcome-icon">
              <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="24" fill="#5865F2" />
                <path d="M18 16C18 16 21 14 24 14C27 14 30 16 30 16V32C30 32 27 30 24 30C21 30 18 32 18 32V16Z" fill="white" opacity="0.9" />
              </svg>
            </div>
            <h2>Welcome to #{roomCode}</h2>
            <p>
              This is the start of your P2P chat. Share the room code or invite
              link with your friends to get started.
            </p>
          </div>

          {messages.map((msg, i) => (
            <MessageItem key={msg.id} msg={msg} prevMsg={messages[i - 1]} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator */}
        {typingText && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span /><span /><span />
            </div>
            <span className="typing-text">{typingText}</span>
          </div>
        )}

        <form className="chat-input-bar" onSubmit={handleSend}>
          <button
            type="button"
            className="btn-icon input-action"
            onClick={() => fileInputRef.current?.click()}
            title="Upload image"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
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
            placeholder={`Message #${roomCode}`}
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

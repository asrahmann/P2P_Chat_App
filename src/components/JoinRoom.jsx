import { useState } from 'react'

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export default function JoinRoom({ onJoin }) {
  const [nickname, setNickname] = useState(
    () => localStorage.getItem('nickname') || ''
  )
  const [roomCode, setRoomCode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('room') || ''
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!nickname.trim()) return
    const code = roomCode.trim() || generateRoomCode()
    localStorage.setItem('nickname', nickname.trim())
    onJoin(code.toUpperCase(), nickname.trim())
  }

  function handleCreate() {
    const code = generateRoomCode()
    setRoomCode(code)
  }

  return (
    <div className="join-screen">
      <div className="join-card">
        <div className="join-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#5865F2" />
            <path
              d="M18 16C18 16 21 14 24 14C27 14 30 16 30 16V32C30 32 27 30 24 30C21 30 18 32 18 32V16Z"
              fill="white"
              opacity="0.9"
            />
            <circle cx="21" cy="22" r="2" fill="#5865F2" />
            <circle cx="27" cy="22" r="2" fill="#5865F2" />
          </svg>
        </div>
        <h1>Shade404 Chat</h1>
        <p className="join-subtitle">
          Connect directly with friends. No servers, no tracking.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="nickname">Nickname</label>
            <input
              id="nickname"
              type="text"
              placeholder="What should people call you?"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="room-code">Room Code</label>
            <div className="room-input-row">
              <input
                id="room-code"
                type="text"
                placeholder="Enter a code or create one"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCreate}
              >
                Generate
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={!nickname.trim()}>
            {roomCode.trim() ? 'Join Room' : 'Create & Join Room'}
          </button>
        </form>
      </div>
    </div>
  )
}

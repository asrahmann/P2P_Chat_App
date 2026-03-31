import { useState } from 'react'

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const values = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(values, (v) => chars[v % chars.length]).join('')
}

export default function JoinRoom({ onJoin }) {
  const [nickname, setNickname] = useState(
    () => localStorage.getItem('nickname') || ''
  )
  const [roomCode, setRoomCode] = useState('')

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
        <h1>Shade404 // Underground</h1>
        <p className="join-subtitle">
          P2P encrypted tunnel. No servers. No logs. No trace.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="nickname">Handle</label>
            <input
              id="nickname"
              type="text"
              placeholder="Enter your handle..."
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="room-code">Tunnel Code</label>
            <div className="room-input-row">
              <input
                id="room-code"
                type="text"
                placeholder="Enter code or generate"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={16}
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
            {roomCode.trim() ? 'Connect' : 'Initialize Tunnel'}
          </button>
        </form>
      </div>
    </div>
  )
}

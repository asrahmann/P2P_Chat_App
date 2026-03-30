import { useState } from 'react'
import JoinRoom from './components/JoinRoom'
import ChatRoom from './components/ChatRoom'

export default function App() {
  const [session, setSession] = useState(null)

  function handleJoin(roomCode, nickname) {
    const url = new URL(window.location)
    url.searchParams.set('room', roomCode)
    window.history.replaceState({}, '', url)
    setSession({ roomCode, nickname })
  }

  function handleLeave() {
    const url = new URL(window.location)
    url.searchParams.delete('room')
    window.history.replaceState({}, '', url)
    setSession(null)
  }

  if (!session) {
    return <JoinRoom onJoin={handleJoin} />
  }

  return (
    <ChatRoom
      roomCode={session.roomCode}
      nickname={session.nickname}
      onLeave={handleLeave}
    />
  )
}

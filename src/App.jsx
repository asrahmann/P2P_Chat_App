import { useState } from 'react'
import JoinRoom from './components/JoinRoom'
import ChatRoom from './components/ChatRoom'

export default function App() {
  const [session, setSession] = useState(null)

  function handleJoin(roomCode, nickname) {
    sessionStorage.setItem('roomCode', roomCode)
    setSession({ roomCode, nickname })
  }

  function handleLeave() {
    sessionStorage.removeItem('roomCode')
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

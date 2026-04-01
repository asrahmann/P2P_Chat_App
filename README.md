# Shade404 // Underground Chat

P2P encrypted group chat with a cyberpunk terminal aesthetic. No servers, no logs, no trace.

Built with [Trystero](https://github.com/dmotz/trystero) for peer-to-peer WebRTC connections and React + Vite.

## Features

- **P2P encrypted messaging** — direct connections between peers, no server relay
- **Audio file sharing** — share mp3, wav, ogg, and other audio files (up to 100 MB)
- **Image sharing** — drag-drop, paste, or file picker with inline preview
- **Live voice chat** — WebRTC-based voice with voice activity detection
- **Network Map** — real-time canvas visualization of all connected nodes; pulses ripple along connection lines when someone sends a message
- **Cipher decode effect** — incoming messages appear as scrambled hacker text that decodes left-to-right
- **Custom user colors** — click your handle to pick from 50 colors, synced to all peers
- **Cyberpunk UI** — monospace fonts, neon borders, CRT scanlines, cracked glass overlay, terminal-style input
- **Typing indicators** — see who's composing a message
- **Sound notifications** — synthesized audio cues for messages, joins, and leaves

## Getting Started

```bash
npm install
npm run dev
```

Open two browser tabs to the same room code to test P2P features.

## Testing

```bash
npx playwright install chromium
npx playwright test
```

Playwright tests cover:

- **Overflow clipping** — verifies message groups don't clip content via `overflow: hidden`
- **Long message rendering** — 600+ char strings, multiline text, and long paragraphs render fully
- **Scroll stability** — new messages don't yank scroll position when reading history
- **Layout shift** — typing indicator doesn't resize the message container
- **Burst rendering** — 50 rapid messages render without errors or dropped frames

P2P message delivery between peers requires real network connections and can't be tested in Playwright — test that with multiple browser tabs or devices on the same room code.

## Tech Stack

- **React 19** + **Vite**
- **Trystero** — P2P WebRTC mesh networking
- **Playwright** — UI stress and regression tests
- **HTML5 Canvas** — Network Map visualization
- **Web Audio API** — sound effects and voice chat

import { useRef, useEffect } from 'react'

function createNode(x, y, color, name) {
  return {
    x, y,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    phase: Math.random() * Math.PI * 2,
    color, name,
    glow: 0,
  }
}

function hexAlpha(hex, alpha) {
  const a = Math.max(0, Math.min(255, Math.floor(alpha * 255)))
  return hex + a.toString(16).padStart(2, '0')
}

export default function NetworkMap({ peers, nickname, userColor, getDefaultColor, lastActivity }) {
  const canvasRef = useRef(null)
  const stateRef = useRef({ nodes: new Map(), pulses: [], packets: [] })
  const animRef = useRef(null)

  // Sync nodes with peer list
  useEffect(() => {
    const { nodes } = stateRef.current
    const canvas = canvasRef.current
    if (!canvas) return
    const w = canvas.width, h = canvas.height, pad = 20

    if (!nodes.has('self')) {
      nodes.set('self', createNode(w / 2, h / 2, userColor, nickname))
    } else {
      const n = nodes.get('self')
      n.color = userColor
      n.name = nickname
    }

    for (const [id, peer] of peers) {
      const color = peer.color || getDefaultColor(peer.nickname)
      if (!nodes.has(id)) {
        nodes.set(id, createNode(
          pad + Math.random() * (w - pad * 2),
          pad + Math.random() * (h - pad * 2),
          color, peer.nickname
        ))
      } else {
        const n = nodes.get(id)
        n.color = color
        n.name = peer.nickname
      }
    }

    for (const id of nodes.keys()) {
      if (id !== 'self' && !peers.has(id)) nodes.delete(id)
    }
  }, [peers, nickname, userColor, getDefaultColor])

  // Trigger pulse + packets on activity
  useEffect(() => {
    if (!lastActivity) return
    const { nodes, pulses, packets } = stateRef.current
    const src = nodes.get(lastActivity.peerId)
    if (!src) return

    src.glow = 1.0
    pulses.push({ x: src.x, y: src.y, radius: 6, color: src.color, alpha: 0.7 })

    for (const [id, target] of nodes) {
      if (id !== lastActivity.peerId) {
        packets.push({
          sx: src.x, sy: src.y, tx: target.x, ty: target.y,
          progress: 0, color: src.color,
        })
      }
    }
  }, [lastActivity])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function draw() {
      const { nodes, pulses, packets } = stateRef.current
      const w = canvas.width, h = canvas.height, pad = 18
      const nodeArr = [...nodes.values()]

      ctx.clearRect(0, 0, w, h)

      // Grid
      ctx.strokeStyle = 'rgba(0, 255, 200, 0.035)'
      ctx.lineWidth = 0.5
      for (let x = 0; x < w; x += 16) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
      }
      for (let y = 0; y < h; y += 16) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
      }

      // Update physics
      for (const n of nodeArr) {
        n.x += n.vx
        n.y += n.vy
        n.phase += 0.012
        n.x += Math.sin(n.phase) * 0.12
        n.y += Math.cos(n.phase * 0.7) * 0.12
        n.vx += (w / 2 - n.x) * 0.00005
        n.vy += (h / 2 - n.y) * 0.00005
        if (n.x < pad) { n.x = pad; n.vx = Math.abs(n.vx) }
        if (n.x > w - pad) { n.x = w - pad; n.vx = -Math.abs(n.vx) }
        if (n.y < pad) { n.y = pad; n.vy = Math.abs(n.vy) }
        if (n.y > h - pad) { n.y = h - pad; n.vy = -Math.abs(n.vy) }
        const spd = Math.sqrt(n.vx ** 2 + n.vy ** 2)
        if (spd > 0.4) { n.vx = (n.vx / spd) * 0.4; n.vy = (n.vy / spd) * 0.4 }
        n.glow *= 0.97
      }

      // Repulsion
      for (let i = 0; i < nodeArr.length; i++) {
        for (let j = i + 1; j < nodeArr.length; j++) {
          const a = nodeArr[i], b = nodeArr[j]
          const dx = b.x - a.x, dy = b.y - a.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 35 && d > 0) {
            const f = (35 - d) * 0.003
            const fx = (dx / d) * f, fy = (dy / d) * f
            a.vx -= fx; a.vy -= fy
            b.vx += fx; b.vy += fy
          }
        }
      }

      // Connections
      for (let i = 0; i < nodeArr.length; i++) {
        for (let j = i + 1; j < nodeArr.length; j++) {
          const a = nodeArr[i], b = nodeArr[j]
          const glow = Math.max(a.glow, b.glow)
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = `rgba(0, 255, 200, ${0.06 + glow * 0.4})`
          ctx.lineWidth = 0.5 + glow * 2
          ctx.stroke()
        }
      }

      // Pulses (expanding rings)
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]
        p.radius += 1
        p.alpha -= 0.01
        if (p.alpha <= 0) { pulses.splice(i, 1); continue }
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.strokeStyle = hexAlpha(p.color, p.alpha)
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Packets (traveling dots along connections)
      ctx.shadowColor = 'rgba(0, 255, 200, 0.8)'
      ctx.shadowBlur = 6
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i]
        p.progress += 0.025
        if (p.progress >= 1) {
          // Flash target node on arrival
          for (const n of nodeArr) {
            const dx = n.x - p.tx, dy = n.y - p.ty
            if (dx * dx + dy * dy < 400) n.glow = Math.max(n.glow, 0.4)
          }
          packets.splice(i, 1)
          continue
        }
        const x = p.sx + (p.tx - p.sx) * p.progress
        const y = p.sy + (p.ty - p.sy) * p.progress
        ctx.beginPath()
        ctx.arc(x, y, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
      }
      ctx.shadowBlur = 0

      // Nodes
      for (const n of nodeArr) {
        // Glow halo
        if (n.glow > 0.05) {
          const r = 6 + n.glow * 14
          const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r)
          grad.addColorStop(0, hexAlpha(n.color, n.glow * 0.5))
          grad.addColorStop(1, 'transparent')
          ctx.beginPath()
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
          ctx.fillStyle = grad
          ctx.fill()
        }

        // Dot
        ctx.beginPath()
        ctx.arc(n.x, n.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = n.color
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'
        ctx.lineWidth = 0.5
        ctx.stroke()

        // Label
        ctx.font = '8px monospace'
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.textAlign = 'center'
        ctx.fillText(n.name, n.x, n.y + 14)
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return (
    <div className="network-map">
      <div className="network-map-header">Network Map</div>
      <canvas ref={canvasRef} width={220} height={160} className="network-map-canvas" />
    </div>
  )
}

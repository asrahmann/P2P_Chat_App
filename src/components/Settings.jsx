import { useState } from 'react'

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('ai-settings') || '{}')
  } catch {
    return {}
  }
}

export default function Settings({ open, onClose }) {
  const [settings, setSettings] = useState(loadSettings)

  function handleSave() {
    localStorage.setItem('ai-settings', JSON.stringify(settings))
    onClose()
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>AI Settings</h2>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-body">
          <div className="input-group">
            <label htmlFor="api-key">API Key</label>
            <input
              id="api-key"
              type="password"
              placeholder="sk-..."
              value={settings.apiKey || ''}
              onChange={(e) =>
                setSettings((s) => ({ ...s, apiKey: e.target.value }))
              }
            />
            <span className="input-hint">
              Your key stays in your browser. Never sent to peers.
            </span>
          </div>

          <div className="input-group">
            <label htmlFor="base-url">Base URL</label>
            <input
              id="base-url"
              type="text"
              placeholder="https://api.openai.com/v1"
              value={settings.baseURL || ''}
              onChange={(e) =>
                setSettings((s) => ({ ...s, baseURL: e.target.value }))
              }
            />
            <span className="input-hint">
              For LM Studio: http://localhost:1234/v1
            </span>
          </div>

          <div className="input-group">
            <label htmlFor="model">Model</label>
            <input
              id="model"
              type="text"
              placeholder="gpt-4.1-mini"
              value={settings.model || ''}
              onChange={(e) =>
                setSettings((s) => ({ ...s, model: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

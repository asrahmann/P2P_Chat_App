import { useCallback, useRef } from 'react'
import OpenAI from 'openai'

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem('ai-settings') || '{}')
  } catch {
    return {}
  }
}

export function useAI(addMessage) {
  const abortRef = useRef(null)

  const ask = useCallback(
    async (prompt, conversationHistory = []) => {
      const settings = getSettings()
      const apiKey = settings.apiKey
      const baseURL = settings.baseURL || 'https://api.openai.com/v1'
      const model = settings.model || 'gpt-4.1-mini'

      if (!apiKey && !settings.baseURL) {
        addMessage({
          id: crypto.randomUUID(),
          type: 'text',
          text: 'AI is not configured. Open Settings (gear icon) to add your API key.',
          sender: 'AI',
          peerId: 'ai',
          timestamp: Date.now(),
        })
        return
      }

      const client = new OpenAI({
        apiKey: apiKey || 'not-needed',
        baseURL,
        dangerouslyAllowBrowser: true,
      })

      // Add a thinking indicator
      const thinkingId = crypto.randomUUID()
      addMessage({
        id: thinkingId,
        type: 'thinking',
        sender: 'AI',
        peerId: 'ai',
        timestamp: Date.now(),
      })

      try {
        abortRef.current = new AbortController()

        const recentMessages = conversationHistory.slice(-20).map((m) => ({
          role: m.sender === 'AI' ? 'assistant' : 'user',
          content: m.sender === 'AI' ? m.text : `${m.sender}: ${m.text}`,
        }))

        const response = await client.chat.completions.create(
          {
            model,
            messages: [
              {
                role: 'system',
                content:
                  'You are a helpful AI assistant in a group chat. Keep responses concise and conversational. You can see messages from multiple users — their name is prefixed before each message.',
              },
              ...recentMessages,
              { role: 'user', content: prompt },
            ],
          },
          { signal: abortRef.current.signal }
        )

        const text = response.choices[0]?.message?.content || 'No response.'

        // Replace thinking with actual response
        addMessage({
          id: thinkingId,
          type: 'replace',
          replaceId: thinkingId,
          replacement: {
            id: crypto.randomUUID(),
            type: 'text',
            text,
            sender: 'AI',
            peerId: 'ai',
            timestamp: Date.now(),
          },
        })
      } catch (err) {
        if (err.name === 'AbortError') return
        addMessage({
          id: thinkingId,
          type: 'replace',
          replaceId: thinkingId,
          replacement: {
            id: crypto.randomUUID(),
            type: 'text',
            text: `Error: ${err.message}`,
            sender: 'AI',
            peerId: 'ai',
            timestamp: Date.now(),
          },
        })
      }
    },
    [addMessage]
  )

  return { ask }
}

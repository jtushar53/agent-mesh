/**
 * LLM Testing Component
 * Interactive UI for loading models and testing chat completions
 */

import { useState } from 'react'
import { LLMService } from '@/services'
import { useAppStore } from '@/store'
import type { ChatMessage } from '@/types'
import './LLMTester.css'

export function LLMTester() {
  const [selectedModel, setSelectedModel] = useState(
    LLMService.MODELS[0]?.id ?? ''
  )
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const {
    llmService,
    setLLMService,
    llmStats,
    setLLMStats,
    modelLoading,
    setModelLoading,
    modelLoadProgress,
    setModelLoadProgress,
  } = useAppStore()

  // Create LLM service instance if it doesn't exist
  const [service] = useState(() => llmService ?? new LLMService())

  const handleLoadModel = async () => {
    if (!selectedModel) return

    setModelLoading(true)
    try {
      await service.initialize(selectedModel, (progress) => {
        setModelLoadProgress(progress)
      })

      const stats = service.getStats()
      setLLMStats(stats)
      setLLMService(service) // Store in global state
      setModelLoadProgress(null)
    } catch (error) {
      console.error('Model loading failed:', error)
      alert(
        `Failed to load model: ${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      setModelLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || !service.isLoaded()) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsGenerating(true)

    try {
      const response = await service.chat({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant running in the browser.',
          },
          ...newMessages,
        ],
        temperature: 0.7,
        maxTokens: 512,
      })

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.content,
      }

      setMessages([...newMessages, assistantMessage])

      // Update stats
      const stats = service.getStats()
      setLLMStats(stats)
    } catch (error) {
      console.error('Generation failed:', error)
      alert(
        `Generation failed: ${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleClearChat = () => {
    setMessages([])
  }

  const handleUnloadModel = async () => {
    await service.unload()
    setLLMService(null)
    setLLMStats(null)
    setMessages([])
  }

  return (
    <div className="llm-tester">
      <div className="llm-header">
        <h2>🧠 Local LLM Testing</h2>
        <p>Test client-side inference with WebLLM</p>
      </div>

      <div className="model-selector">
        <label htmlFor="model-select">Select Model:</label>
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={modelLoading || service.isLoaded()}
        >
          {LLMService.MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} - {model.size} ({model.downloadSize}MB)
            </option>
          ))}
        </select>

        {!service.isLoaded() ? (
          <button
            onClick={handleLoadModel}
            disabled={modelLoading || !selectedModel}
            className="btn-primary"
          >
            {modelLoading ? 'Loading...' : 'Load Model'}
          </button>
        ) : (
          <button onClick={handleUnloadModel} className="btn-secondary">
            Unload Model
          </button>
        )}
      </div>

      {modelLoadProgress && (
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${modelLoadProgress.progress * 100}%` }}
            />
          </div>
          <p className="progress-text">{modelLoadProgress.text}</p>
        </div>
      )}

      {llmStats?.modelLoaded && (
        <div className="stats-container">
          <h3>Model Stats</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Model:</span>
              <span className="stat-value">{llmStats.modelName}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Load Time:</span>
              <span className="stat-value">
                {(llmStats.loadTime / 1000).toFixed(2)}s
              </span>
            </div>
            {llmStats.tokensPerSecond > 0 && (
              <div className="stat-item">
                <span className="stat-label">Speed:</span>
                <span className="stat-value">
                  {llmStats.tokensPerSecond.toFixed(2)} tok/s
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {service.isLoaded() && (
        <div className="chat-container">
          <div className="chat-header">
            <h3>Chat Interface</h3>
            <button onClick={handleClearChat} className="btn-small">
              Clear Chat
            </button>
          </div>

          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="empty-state">
                <p>No messages yet. Start a conversation!</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`message message-${msg.role}`}>
                  <div className="message-role">
                    {msg.role === 'user' ? '👤 You' : '🤖 Assistant'}
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))
            )}
          </div>

          <div className="input-container">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
              disabled={isGenerating}
              rows={3}
            />
            <button
              onClick={handleSendMessage}
              disabled={isGenerating || !input.trim()}
              className="btn-primary"
            >
              {isGenerating ? 'Generating...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

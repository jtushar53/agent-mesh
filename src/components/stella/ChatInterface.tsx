/**
 * Chat Interface - Main interaction component for Project Stella
 * Features a cyber-aesthetic chat interface with markdown support
 */

import { useState, useRef, useEffect } from 'react'
import type { ChatMessage } from '@/types/llm'
import './ChatInterface.css'

interface ChatInterfaceProps {
  messages: ChatMessage[]
  isProcessing: boolean
  isModelLoading: boolean
  loadProgress?: { text: string; progress: number } | undefined
  onSendMessage: (message: string) => void
  onClearChat: () => void
}

export function ChatInterface({
  messages,
  isProcessing,
  isModelLoading,
  loadProgress,
  onSendMessage,
  onClearChat,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing || isModelLoading) return

    onSendMessage(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const formatContent = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />')
  }

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div className="header-left">
          <h2 className="chat-title">
            <span className="title-icon">🍎</span>
            <span className="title-text">STELLA</span>
          </h2>
          <span className="chat-subtitle">The Local Intelligence OS</span>
        </div>
        <div className="header-right">
          <button
            className="btn btn-ghost"
            onClick={onClearChat}
            disabled={messages.length === 0 || isProcessing}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {isModelLoading ? (
          <div className="loading-state">
            <div className="loading-icon">🧠</div>
            <div className="loading-text">
              {loadProgress?.text || 'Loading model...'}
            </div>
            {loadProgress && (
              <div className="loading-progress">
                <div
                  className="progress-fill"
                  style={{ width: `${loadProgress.progress * 100}%` }}
                />
              </div>
            )}
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🍎</div>
            <h3 className="empty-title">Welcome to Project Stella</h3>
            <p className="empty-text">
              The world's intelligence, disconnected.
              <br />
              Your privacy-first, browser-native AI assistant.
            </p>
            <div className="empty-hints">
              <div className="hint">💡 "Help me write a function to..."</div>
              <div className="hint">📚 "Explain how..."</div>
              <div className="hint">🔍 "Research..."</div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`chat-message ${msg.role}`}
              >
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '🍎'}
                </div>
                <div className="message-content">
                  <div className="message-header">
                    <span className="message-role">
                      {msg.role === 'user' ? 'You' : 'Stella'}
                    </span>
                  </div>
                  <div
                    className="message-text"
                    dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                  />
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="chat-message assistant processing">
                <div className="message-avatar">🍎</div>
                <div className="message-content">
                  <div className="processing-indicator">
                    <span className="processing-dot" />
                    <span className="processing-dot" />
                    <span className="processing-dot" />
                  </div>
                  <span className="processing-text">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <form className="chat-input-container" onSubmit={handleSubmit}>
        <div className="input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isModelLoading
                ? 'Loading model...'
                : isProcessing
                ? 'Processing...'
                : 'Ask Stella anything...'
            }
            disabled={isModelLoading || isProcessing}
            rows={1}
          />
          <button
            type="submit"
            className="send-button"
            disabled={!input.trim() || isProcessing || isModelLoading}
          >
            <span className="send-icon">→</span>
          </button>
        </div>
        <div className="input-hints">
          <span className="hint-key">Enter</span> to send,{' '}
          <span className="hint-key">Shift + Enter</span> for new line
        </div>
      </form>
    </div>
  )
}

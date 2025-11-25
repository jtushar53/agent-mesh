/**
 * Den Den Mushi - MCP Connection Status Indicator
 * Visual indicator for the connection state inspired by One Piece's communication device
 */

import { useEffect, useState } from 'react'
import type { DenDenMushiState } from '@/types/satellites'
import './DenDenMushi.css'

interface DenDenMushiProps {
  state: DenDenMushiState
  serverName?: string
}

export function DenDenMushi({ state, serverName }: DenDenMushiProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (state === 'call' || state === 'signal') {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 500)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [state])

  const getStateInfo = () => {
    switch (state) {
      case 'sleep':
        return {
          emoji: '🐌',
          label: 'Offline',
          description: 'Air-gapped mode',
          className: 'sleep',
        }
      case 'call':
        return {
          emoji: '🐌📢',
          label: 'Calling',
          description: 'Tool execution in progress',
          className: 'call',
        }
      case 'signal':
        return {
          emoji: '🐌✨',
          label: 'Connected',
          description: serverName || 'Receiving data',
          className: 'signal',
        }
      default:
        return {
          emoji: '🐌',
          label: 'Unknown',
          description: 'Unknown state',
          className: 'sleep',
        }
    }
  }

  const info = getStateInfo()

  return (
    <div className={`dendenmushi ${info.className} ${isAnimating ? 'animating' : ''}`}>
      <div className="dendenmushi-shell">
        <div className="dendenmushi-body">
          <span className="dendenmushi-emoji">{info.emoji}</span>
        </div>
        <div className="dendenmushi-antenna">
          <div className="antenna-segment" />
          <div className="antenna-segment" />
          <div className="antenna-tip" />
        </div>
      </div>
      <div className="dendenmushi-info">
        <span className="dendenmushi-label">{info.label}</span>
        <span className="dendenmushi-description">{info.description}</span>
      </div>
      {state === 'call' && (
        <div className="dendenmushi-waves">
          <div className="wave wave-1" />
          <div className="wave wave-2" />
          <div className="wave wave-3" />
        </div>
      )}
    </div>
  )
}

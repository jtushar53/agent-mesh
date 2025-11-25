/**
 * Satellite Panel - Displays the status of all 6 satellites
 * Visual dashboard for the Agent Mesh
 */

import type { SatelliteId, SatelliteState, SatelliteStatus } from '@/types/satellites'
import './SatellitePanel.css'

interface SatellitePanelProps {
  satellites: Map<SatelliteId, SatelliteState>
  activeSatellite?: SatelliteId | undefined
}

interface SatelliteInfo {
  id: SatelliteId
  name: string
  archetype: string
  role: string
  emoji: string
  color: string
}

const satelliteInfos: SatelliteInfo[] = [
  {
    id: 'shaka',
    name: 'SHAKA',
    archetype: 'Logic',
    role: 'Orchestrator',
    emoji: '👑',
    color: 'var(--color-shaka)',
  },
  {
    id: 'lilith',
    name: 'LILITH',
    archetype: 'Evil',
    role: 'Critic',
    emoji: '👿',
    color: 'var(--color-lilith)',
  },
  {
    id: 'edison',
    name: 'EDISON',
    archetype: 'Thinking',
    role: 'Inventor',
    emoji: '💡',
    color: 'var(--color-edison)',
  },
  {
    id: 'pythagoras',
    name: 'PYTHAGORAS',
    archetype: 'Wisdom',
    role: 'Researcher',
    emoji: '📚',
    color: 'var(--color-pythagoras)',
  },
  {
    id: 'atlas',
    name: 'ATLAS',
    archetype: 'Violence',
    role: 'Executor',
    emoji: '⚡',
    color: 'var(--color-atlas)',
  },
  {
    id: 'york',
    name: 'YORK',
    archetype: 'Greed',
    role: 'Manager',
    emoji: '💰',
    color: 'var(--color-york)',
  },
]

const statusLabels: Record<SatelliteStatus, string> = {
  idle: 'IDLE',
  thinking: 'THINKING',
  executing: 'EXECUTING',
  waiting: 'WAITING',
  completed: 'COMPLETED',
  error: 'ERROR',
}

export function SatellitePanel({ satellites, activeSatellite }: SatellitePanelProps) {
  return (
    <div className="satellite-panel">
      <div className="satellite-panel-header">
        <h3>SATELLITES</h3>
        <span className="header-subtitle">Agent Mesh Status</span>
      </div>

      <div className="satellite-grid">
        {satelliteInfos.map((info) => {
          const state = satellites.get(info.id)
          const isActive = activeSatellite === info.id
          const status = state?.status || 'idle'

          return (
            <div
              key={info.id}
              className={`satellite-card ${status} ${isActive ? 'active' : ''}`}
              style={{ '--satellite-color': info.color } as React.CSSProperties}
            >
              <div className="satellite-avatar">
                <span className="satellite-emoji">{info.emoji}</span>
                <div className="satellite-ring" />
              </div>

              <div className="satellite-info">
                <div className="satellite-name">{info.name}</div>
                <div className="satellite-archetype">{info.archetype}</div>
              </div>

              <div className="satellite-status">
                <div className={`status-indicator ${status}`} />
                <span className="status-label">{statusLabels[status]}</span>
              </div>

              {state?.progress !== undefined && state.progress > 0 && state.progress < 100 && (
                <div className="satellite-progress">
                  <div
                    className="progress-bar"
                    style={{ width: `${state.progress}%` }}
                  />
                </div>
              )}

              {status === 'thinking' && (
                <div className="thinking-animation">
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Log Pose - Navigation Timeline
 * Tracks the user's journey through tasks, inspired by One Piece's navigation device
 */

import { useMemo } from 'react'
import type { SatelliteId } from '@/types/satellites'
import './LogPose.css'

interface LogPoseEntry {
  id: string
  type: 'user' | 'task' | 'result' | 'system'
  content: string
  satelliteId?: SatelliteId
  status?: 'pending' | 'active' | 'completed' | 'failed'
  timestamp: number
}

interface LogPoseProps {
  entries: LogPoseEntry[]
  currentIndex?: number
  onEntryClick?: (entry: LogPoseEntry) => void
}

const satelliteEmojis: Record<SatelliteId, string> = {
  shaka: '👑',
  lilith: '👿',
  edison: '💡',
  pythagoras: '📚',
  atlas: '⚡',
  york: '💰',
}

const satelliteNames: Record<SatelliteId, string> = {
  shaka: 'SHAKA',
  lilith: 'LILITH',
  edison: 'EDISON',
  pythagoras: 'PYTHAGORAS',
  atlas: 'ATLAS',
  york: 'YORK',
}

export function LogPose({ entries, currentIndex, onEntryClick }: LogPoseProps) {
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => a.timestamp - b.timestamp)
  }, [entries])

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getStatusClass = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'status-completed'
      case 'active':
        return 'status-active'
      case 'failed':
        return 'status-failed'
      default:
        return 'status-pending'
    }
  }

  return (
    <div className="logpose">
      <div className="logpose-header">
        <div className="logpose-compass">
          <div className="compass-ring">
            <div className="compass-needle" />
          </div>
        </div>
        <div className="logpose-title">
          <span className="title-main">Log Pose</span>
          <span className="title-sub">Journey Timeline</span>
        </div>
      </div>

      <div className="logpose-timeline">
        {sortedEntries.length === 0 ? (
          <div className="logpose-empty">
            <span className="empty-icon">🧭</span>
            <span className="empty-text">Begin your journey...</span>
          </div>
        ) : (
          sortedEntries.map((entry, index) => (
            <div
              key={entry.id}
              className={`logpose-entry ${entry.type} ${getStatusClass(entry.status)} ${index === currentIndex ? 'current' : ''}`}
              onClick={() => onEntryClick?.(entry)}
            >
              <div className="entry-connector">
                <div className="connector-line" />
                <div className="connector-node">
                  {entry.satelliteId ? (
                    <span className="node-emoji">{satelliteEmojis[entry.satelliteId]}</span>
                  ) : entry.type === 'user' ? (
                    <span className="node-emoji">👤</span>
                  ) : (
                    <span className="node-emoji">⚙️</span>
                  )}
                </div>
              </div>

              <div className="entry-content">
                <div className="entry-header">
                  {entry.satelliteId && (
                    <span className={`entry-satellite satellite-${entry.satelliteId}`}>
                      {satelliteNames[entry.satelliteId]}
                    </span>
                  )}
                  <span className="entry-time">{formatTime(entry.timestamp)}</span>
                </div>
                <p className="entry-text">{entry.content}</p>
                {entry.status && (
                  <span className={`entry-status ${entry.status}`}>
                    {entry.status === 'active' && '● '}
                    {entry.status.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export type { LogPoseEntry }

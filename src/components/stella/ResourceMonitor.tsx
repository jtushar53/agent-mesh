/**
 * Resource Monitor - Displays system resource usage
 * Shows context tokens, memory usage, and other metrics
 */

import type { ResourceMetrics } from '@/types/satellites'
import './ResourceMonitor.css'

interface ResourceMonitorProps {
  resources: ResourceMetrics
  onBrainCut?: () => void
}

export function ResourceMonitor({ resources, onBrainCut }: ResourceMonitorProps) {
  const contextUsage = resources.contextTokens / resources.maxContextTokens
  const contextPercent = Math.round(contextUsage * 100)

  const getContextStatus = () => {
    if (contextUsage < 0.5) return 'low'
    if (contextUsage < 0.8) return 'medium'
    return 'high'
  }

  return (
    <div className="resource-monitor">
      <div className="monitor-header">
        <h4>RESOURCES</h4>
        <span className="monitor-label">YORK Status</span>
      </div>

      <div className="resource-grid">
        {/* Context Usage */}
        <div className={`resource-item context ${getContextStatus()}`}>
          <div className="resource-header">
            <span className="resource-icon">📊</span>
            <span className="resource-name">Context</span>
          </div>
          <div className="resource-bar">
            <div
              className="bar-fill"
              style={{ width: `${contextPercent}%` }}
            />
          </div>
          <div className="resource-values">
            <span>{resources.contextTokens.toLocaleString()}</span>
            <span>/</span>
            <span>{resources.maxContextTokens.toLocaleString()}</span>
            <span className="resource-unit">tokens</span>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="resource-item memory">
          <div className="resource-header">
            <span className="resource-icon">🧠</span>
            <span className="resource-name">Memory</span>
          </div>
          <div className="resource-value">
            <span className="value-number">{resources.memoryUsage}</span>
            <span className="value-unit">MB</span>
          </div>
        </div>

        {/* Inference Speed */}
        <div className="resource-item speed">
          <div className="resource-header">
            <span className="resource-icon">⚡</span>
            <span className="resource-name">Speed</span>
          </div>
          <div className="resource-value">
            <span className="value-number">
              {resources.inferenceSpeed > 0 ? resources.inferenceSpeed.toFixed(1) : '--'}
            </span>
            <span className="value-unit">tok/s</span>
          </div>
        </div>

        {/* Active Agents */}
        <div className="resource-item agents">
          <div className="resource-header">
            <span className="resource-icon">🛸</span>
            <span className="resource-name">Active</span>
          </div>
          <div className="resource-value">
            <span className="value-number">{resources.activeAgents}</span>
            <span className="value-unit">agents</span>
          </div>
        </div>
      </div>

      {contextUsage >= 0.8 && onBrainCut && (
        <button className="brain-cut-btn" onClick={onBrainCut}>
          <span className="btn-icon">✂️</span>
          <span className="btn-text">Brain-Brain Cut</span>
        </button>
      )}
    </div>
  )
}

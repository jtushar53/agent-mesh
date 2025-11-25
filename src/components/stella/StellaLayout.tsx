/**
 * Stella Layout - Main application layout
 * Combines all components with Egghead Aesthetics
 */

import { useState, useEffect, useCallback } from 'react'
import { DenDenMushi } from './DenDenMushi'
import { LogPose, type LogPoseEntry } from './LogPose'
import { SatellitePanel } from './SatellitePanel'
import { ChatInterface } from './ChatInterface'
import { ResourceMonitor } from './ResourceMonitor'
import type { ChatMessage } from '@/types/llm'
import type { SatelliteId, SatelliteState, DenDenMushiState, ResourceMetrics } from '@/types/satellites'
import { AgentMesh } from '@/services/agent-mesh'
import { LLMService } from '@/services/llm-service'
import { useAppStore } from '@/store'
import { logger } from '@/utils'
import './StellaLayout.css'

export function StellaLayout() {
  // Store state
  const {
    modelLoading,
    setModelLoading,
    modelLoadProgress,
    setModelLoadProgress,
  } = useAppStore()

  // Local state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [logEntries, setLogEntries] = useState<LogPoseEntry[]>([])
  const [satellites, setSatellites] = useState<Map<SatelliteId, SatelliteState>>(new Map())
  const [denDenMushiState, setDenDenMushiState] = useState<DenDenMushiState>('sleep')
  const [resources, setResources] = useState<ResourceMetrics>({
    memoryUsage: 0,
    contextTokens: 0,
    maxContextTokens: 4096,
    activeAgents: 0,
    inferenceSpeed: 0,
  })
  const [activeSatellite, setActiveSatellite] = useState<SatelliteId | undefined>()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Services
  const [llmService] = useState(() => new LLMService())
  const [agentMesh, setAgentMesh] = useState<AgentMesh | null>(null)

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      setModelLoading(true)

      try {
        // Initialize LLM
        const recommendedModel = LLMService.getRecommendedModel()
        await llmService.initialize(recommendedModel.id, (progress) => {
          setModelLoadProgress(progress)
        })

        // Initialize Agent Mesh
        const mesh = new AgentMesh(llmService)
        await mesh.initialize()

        // Subscribe to mesh events
        mesh.onEvent((event) => {
          logger.debug('Mesh event', { type: event.type, data: event.data })

          if (event.type === 'task_started') {
            const data = event.data as { task: { satelliteId: SatelliteId; description: string } }
            setActiveSatellite(data.task.satelliteId)
            addLogEntry({
              type: 'task',
              content: data.task.description,
              satelliteId: data.task.satelliteId,
              status: 'active',
            })
          }

          if (event.type === 'task_completed') {
            const data = event.data as { result: { success: boolean } }
            addLogEntry({
              type: 'result',
              content: data.result.success ? 'Task completed' : 'Task failed',
              status: data.result.success ? 'completed' : 'failed',
            })
          }

          // Update states
          const state = mesh.getState()
          setSatellites(state.satellites)
          setResources(state.resources)
          setDenDenMushiState(mesh.getDenDenMushiState())
        })

        setAgentMesh(mesh)

        // Initial state
        setSatellites(mesh.getState().satellites)
        setResources(mesh.getResourceMetrics())

        logger.info('Stella initialized successfully')
      } catch (error) {
        logger.error('Failed to initialize Stella', { error })
      } finally {
        setModelLoading(false)
        setModelLoadProgress(null)
      }
    }

    init()
  }, [llmService, setModelLoading, setModelLoadProgress])

  // Add log entry helper
  const addLogEntry = useCallback((entry: Omit<LogPoseEntry, 'id' | 'timestamp'>) => {
    setLogEntries(prev => [...prev, {
      ...entry,
      id: `entry-${Date.now()}`,
      timestamp: Date.now(),
    }])
  }, [])

  // Handle sending message
  const handleSendMessage = useCallback(async (content: string) => {
    if (!agentMesh || isProcessing) return

    // Add user message
    const userMessage: ChatMessage = { role: 'user', content }
    setMessages(prev => [...prev, userMessage])

    // Add to log
    addLogEntry({
      type: 'user',
      content: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
      status: 'completed',
    })

    setIsProcessing(true)
    setActiveSatellite('shaka')

    try {
      const response = await agentMesh.processRequest(content)

      // Add assistant message
      const assistantMessage: ChatMessage = { role: 'assistant', content: response }
      setMessages(prev => [...prev, assistantMessage])

      // Update resources
      setResources(agentMesh.getResourceMetrics())

    } catch (error) {
      logger.error('Failed to process message', { error })

      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      setMessages(prev => [...prev, errorMessage])

      addLogEntry({
        type: 'system',
        content: 'Error occurred during processing',
        status: 'failed',
      })
    } finally {
      setIsProcessing(false)
      setActiveSatellite(undefined)
    }
  }, [agentMesh, isProcessing, addLogEntry])

  // Handle clear chat
  const handleClearChat = useCallback(() => {
    setMessages([])
    setLogEntries([])
    agentMesh?.clearContext()
    setResources(agentMesh?.getResourceMetrics() || resources)
  }, [agentMesh, resources])

  return (
    <div className="stella-layout">
      {/* Background grid */}
      <div className="grid-bg" />

      {/* Header */}
      <header className="stella-header">
        <div className="header-brand">
          <span className="brand-icon">🍎</span>
          <div className="brand-text">
            <h1>STELLA</h1>
            <span className="brand-tagline">The Local Intelligence OS</span>
          </div>
        </div>

        <div className="header-status">
          <DenDenMushi state={denDenMushiState} />
        </div>

        <button
          className="sidebar-toggle btn btn-ghost"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? '◀' : '▶'}
        </button>
      </header>

      {/* Main Content */}
      <main className="stella-main">
        {/* Chat Area */}
        <div className="chat-area">
          <ChatInterface
            messages={messages}
            isProcessing={isProcessing}
            isModelLoading={modelLoading}
            loadProgress={modelLoadProgress ?? undefined}
            onSendMessage={handleSendMessage}
            onClearChat={handleClearChat}
          />
        </div>

        {/* Sidebar */}
        <aside className={`stella-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-section">
            <SatellitePanel
              satellites={satellites}
              activeSatellite={activeSatellite}
            />
          </div>

          <div className="sidebar-section flex-grow">
            <LogPose entries={logEntries} />
          </div>

          <div className="sidebar-section">
            <ResourceMonitor resources={resources} />
          </div>
        </aside>
      </main>
    </div>
  )
}

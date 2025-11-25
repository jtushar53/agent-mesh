/**
 * Satellite Agent Type Definitions
 * The 6 specialized agents in Project Stella's Agent Mesh
 */

import type { MCPTool } from './mcp'

/**
 * Satellite archetypes based on Dr. Vegapunk's design
 */
export type SatelliteArchetype =
  | 'logic'      // SHAKA - Logic & Good
  | 'evil'       // LILITH - Malice against errors
  | 'thinking'   // EDISON - Creative/Engineering
  | 'wisdom'     // PYTHAGORAS - Research/Knowledge
  | 'violence'   // ATLAS - Action/Execution
  | 'greed'      // YORK - Resource optimization

export type SatelliteId =
  | 'shaka'
  | 'lilith'
  | 'edison'
  | 'pythagoras'
  | 'atlas'
  | 'york'

export type SatelliteStatus =
  | 'idle'
  | 'thinking'
  | 'executing'
  | 'waiting'
  | 'completed'
  | 'error'

/**
 * Base satellite configuration
 */
export interface SatelliteConfig {
  id: SatelliteId
  name: string
  archetype: SatelliteArchetype
  description: string
  role: string
  systemPrompt: string
  capabilities: string[]
  tools: MCPTool[]
  maxIterations: number
  temperature: number
  priority: number // Higher priority satellites execute first
}

/**
 * Satellite execution state
 */
export interface SatelliteState {
  id: SatelliteId
  status: SatelliteStatus
  currentTask?: string
  progress: number // 0-100
  output?: string
  error?: string
  startTime?: number
  endTime?: number
  iterations: number
  tokensUsed: number
}

/**
 * Task assignment from SHAKA (Orchestrator)
 */
export interface SatelliteTask {
  id: string
  satelliteId: SatelliteId
  description: string
  input: string
  context?: Record<string, unknown>
  dependencies: string[] // Task IDs that must complete first
  priority: number
  deadline?: number
  createdAt: number
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed'
}

/**
 * Task result from a satellite
 */
export interface SatelliteResult {
  taskId: string
  satelliteId: SatelliteId
  success: boolean
  output: string
  artifacts?: Artifact[] | undefined
  metrics: ExecutionMetrics
  error?: string | undefined
}

/**
 * Artifact produced by satellites
 */
export interface Artifact {
  id: string
  type: 'code' | 'text' | 'data' | 'analysis' | 'summary'
  content: string
  metadata: Record<string, unknown>
}

/**
 * Execution metrics
 */
export interface ExecutionMetrics {
  duration: number
  tokensUsed: number
  iterationCount: number
  toolCallCount: number
  memoryAccesses: number
}

/**
 * DAG Node for task orchestration
 */
export interface DAGNode {
  id: string
  taskId: string
  satelliteId: SatelliteId
  status: 'pending' | 'ready' | 'running' | 'completed' | 'failed'
  dependencies: string[]
  dependents: string[]
  result?: SatelliteResult
}

/**
 * Task Dependency Graph
 */
export interface TaskDAG {
  nodes: Map<string, DAGNode>
  rootNodes: string[]
  leafNodes: string[]
}

/**
 * SHAKA's plan structure
 */
export interface ExecutionPlan {
  id: string
  userIntent: string
  analysis: string
  tasks: SatelliteTask[]
  dag: TaskDAG
  estimatedDuration?: number
  createdAt: number
}

/**
 * LILITH's critique structure
 */
export interface Critique {
  id: string
  targetId: string // What is being critiqued
  targetType: 'code' | 'text' | 'plan' | 'output'
  issues: CritiqueIssue[]
  score: number // 0-100
  recommendation: string
  approved: boolean
}

export interface CritiqueIssue {
  type: 'error' | 'warning' | 'suggestion' | 'security' | 'hallucination'
  severity: 'critical' | 'major' | 'minor' | 'info'
  description: string
  location?: string
  suggestion?: string
}

/**
 * EDISON's code generation context
 */
export interface CodeGenContext {
  language: string
  framework?: string
  existingCode?: string
  codeStyle?: string
  requirements: string[]
  constraints: string[]
}

/**
 * PYTHAGORAS's research query
 */
export interface ResearchQuery {
  question: string
  searchVariations: string[]
  sources: SearchSource[]
  findings: ResearchFinding[]
  synthesis: string
}

export interface SearchSource {
  id: string
  type: 'punk_records' | 'graph' | 'web' | 'user_provided'
  title: string
  content: string
  relevance: number
}

export interface ResearchFinding {
  sourceId: string
  excerpt: string
  relevance: number
  confidence: number
}

/**
 * ATLAS's tool execution request
 */
export interface ToolExecutionRequest {
  toolName: string
  arguments: Record<string, unknown>
  retryCount: number
  maxRetries: number
  timeout: number
}

/**
 * YORK's resource metrics
 */
export interface ResourceMetrics {
  memoryUsage: number // MB
  contextTokens: number
  maxContextTokens: number
  activeAgents: number
  batteryLevel?: number
  inferenceSpeed: number // tokens/sec
}

/**
 * YORK's context eviction decision
 */
export interface EvictionDecision {
  shouldEvict: boolean
  tokensToFree: number
  messagesToSummarize: number
  priority: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Inter-satellite message
 */
export interface SatelliteMessage {
  id: string
  from: SatelliteId
  to: SatelliteId | 'broadcast'
  type: 'request' | 'response' | 'notification' | 'error'
  payload: unknown
  timestamp: number
  correlationId?: string
}

/**
 * Agent Mesh state
 */
export interface AgentMeshState {
  satellites: Map<SatelliteId, SatelliteState>
  activePlan?: ExecutionPlan | undefined
  messageQueue: SatelliteMessage[]
  resources: ResourceMetrics
  lastUpdate: number
}

/**
 * Den Den Mushi (MCP) connection state
 */
export type DenDenMushiState =
  | 'sleep'    // 🐌 Offline / Air-gapped
  | 'call'     // 🐌📢 Tool Execution in progress
  | 'signal'   // 🐌✨ Data received from external source

/**
 * Conversation history for context
 */
export interface ConversationTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  satelliteId?: SatelliteId
  timestamp: number
  tokenCount: number
}

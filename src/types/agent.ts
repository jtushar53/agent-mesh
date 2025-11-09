/**
 * Agent framework type definitions
 */

import type { ChatMessage } from './llm'
import type { MCPTool, MCPToolResult } from './mcp'

export type AgentStatus = 'idle' | 'thinking' | 'acting' | 'completed' | 'error'

export type StepType = 'thought' | 'action' | 'observation' | 'final_answer'

export interface AgentStep {
  type: StepType
  content: string
  timestamp: number
  toolName?: string
  toolInput?: Record<string, unknown>
  toolOutput?: unknown
  error?: string
}

export interface AgentState {
  status: AgentStatus
  steps: AgentStep[]
  currentStep: number
  result?: string
  error?: string
  startTime: number
  endTime?: number
}

export interface AgentConfig {
  name: string
  description: string
  instructions: string
  model: string
  maxIterations: number
  temperature: number
  tools: MCPTool[]
  memory?: AgentMemory
}

export interface AgentMemory {
  shortTerm: ChatMessage[]
  longTerm: Map<string, unknown>
  workingMemory: Map<string, unknown>
}

export interface ToolExecution {
  toolName: string
  input: Record<string, unknown>
  output: MCPToolResult
  duration: number
  timestamp: number
}

export interface AgentExecution {
  id: string
  agentName: string
  input: string
  state: AgentState
  toolExecutions: ToolExecution[]
  createdAt: number
  updatedAt: number
}

export interface ReActPromptContext {
  task: string
  availableTools: string
  previousSteps: string
  observations: string
}

export type AgentEventType =
  | 'start'
  | 'thinking'
  | 'tool_call'
  | 'observation'
  | 'complete'
  | 'error'

export interface AgentEvent {
  type: AgentEventType
  data: unknown
  timestamp: number
}

export type AgentEventCallback = (event: AgentEvent) => void

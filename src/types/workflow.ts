/**
 * Visual workflow type definitions
 */

import type { Node, Edge } from 'reactflow'

export type NodeType = 'mcpTool' | 'llmAgent' | 'input' | 'output' | 'condition'

export interface BaseNodeData {
  label: string
  description?: string
}

export interface MCPToolNodeData extends BaseNodeData {
  toolName: string
  serverUrl: string
  parameters: Record<string, unknown>
}

export interface LLMAgentNodeData extends BaseNodeData {
  agentName: string
  model: string
  instructions: string
  temperature: number
}

export interface InputNodeData extends BaseNodeData {
  value: string
  type: 'text' | 'json' | 'file'
}

export interface OutputNodeData extends BaseNodeData {
  format: 'text' | 'json' | 'markdown'
  value?: unknown
}

export interface ConditionNodeData extends BaseNodeData {
  condition: string
  trueLabel: string
  falseLabel: string
}

export type WorkflowNodeData =
  | MCPToolNodeData
  | LLMAgentNodeData
  | InputNodeData
  | OutputNodeData
  | ConditionNodeData

export interface WorkflowNode extends Node<WorkflowNodeData> {
  type: NodeType
  data: WorkflowNodeData
}

export type WorkflowEdge = Edge & {
  animated?: boolean
  label?: string
}

export interface Workflow {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  createdAt: number
  updatedAt: number
}

export type WorkflowExecutionStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'error'

export interface WorkflowExecution {
  id: string
  workflowId: string
  status: WorkflowExecutionStatus
  currentNodeId?: string
  results: Map<string, unknown>
  errors: Map<string, string>
  startTime: number
  endTime?: number
}

export interface NodeExecutionResult {
  nodeId: string
  success: boolean
  output: unknown
  error?: string
  executionTime: number
}

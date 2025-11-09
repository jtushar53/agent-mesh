/**
 * Model Context Protocol (MCP) type definitions
 */

import type { z } from 'zod'

export interface MCPServerConfig {
  name: string
  url: string
  description?: string
  enabled: boolean
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: z.ZodType<unknown>
  destructiveHint?: boolean
}

export interface MCPToolCall {
  toolName: string
  arguments: Record<string, unknown>
  timestamp: number
}

export interface MCPToolResult {
  success: boolean
  content: unknown
  error?: string
  executionTime: number
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPPrompt {
  name: string
  description?: string
  arguments?: Record<string, unknown>
}

export interface MCPSession {
  sessionId: string
  serverUrl: string
  connected: boolean
  capabilities?: MCPCapabilities
  tools: MCPTool[]
  resources: MCPResource[]
  prompts: MCPPrompt[]
}

export interface MCPCapabilities {
  tools?: boolean
  resources?: boolean
  prompts?: boolean
}

export type MCPConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

export interface MCPError {
  code: string
  message: string
  details?: unknown
}

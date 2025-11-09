/**
 * Common type definitions for AgentMesh
 */

export type UUID = string

export type Timestamp = number

export interface BaseEntity {
  id: UUID
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type Status = 'idle' | 'loading' | 'success' | 'error'

export interface ApiResponse<T> {
  data?: T
  error?: string
  status: Status
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: Timestamp
  context?: Record<string, unknown>
}

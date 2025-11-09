/**
 * Logger utility for AgentMesh
 */

import type { LogLevel, LogEntry } from '@/types'

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 1000

  private formatMessage(level: LogLevel, message: string, context?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` | ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  private addLog(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
    }

    this.logs.push(entry)

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.addLog('debug', message, context)
    console.debug(this.formatMessage('debug', message, context))
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.addLog('info', message, context)
    console.info(this.formatMessage('info', message, context))
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.addLog('warn', message, context)
    console.warn(this.formatMessage('warn', message, context))
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.addLog('error', message, context)
    console.error(this.formatMessage('error', message, context))
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter((log) => log.level === level)
    }
    return [...this.logs]
  }

  clearLogs(): void {
    this.logs = []
  }
}

export const logger = new Logger()

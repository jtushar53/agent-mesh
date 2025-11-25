/**
 * Base Satellite Class
 * Abstract base class for all satellite agents in Project Stella
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  SatelliteConfig,
  SatelliteState,
  SatelliteTask,
  SatelliteResult,
  SatelliteMessage,
  SatelliteId,
  ExecutionMetrics,
  Artifact,
} from '@/types/satellites'
import type { ChatMessage } from '@/types/llm'
import type { LLMService } from '@/services/llm-service'
import type { PunkRecords } from '@/services/punk-records'
import { logger } from '@/utils'

export type SatelliteEventType =
  | 'started'
  | 'thinking'
  | 'executing'
  | 'completed'
  | 'error'
  | 'message'

export interface SatelliteEvent {
  type: SatelliteEventType
  satelliteId: SatelliteId
  data: unknown
  timestamp: number
}

export type SatelliteEventCallback = (event: SatelliteEvent) => void

/**
 * Abstract base class for all satellites
 */
export abstract class BaseSatellite {
  protected config: SatelliteConfig
  protected state: SatelliteState
  protected llmService: LLMService
  protected punkRecords: PunkRecords
  protected eventCallbacks: SatelliteEventCallback[] = []
  protected messageHandlers: Map<string, (message: SatelliteMessage) => Promise<void>> = new Map()

  constructor(
    config: SatelliteConfig,
    llmService: LLMService,
    punkRecords: PunkRecords
  ) {
    this.config = config
    this.llmService = llmService
    this.punkRecords = punkRecords
    this.state = this.createInitialState()

    logger.info(`Satellite ${config.name} initialized`, {
      id: config.id,
      archetype: config.archetype,
    })
  }

  /**
   * Create initial state for the satellite
   */
  protected createInitialState(): SatelliteState {
    return {
      id: this.config.id,
      status: 'idle',
      progress: 0,
      iterations: 0,
      tokensUsed: 0,
    }
  }

  /**
   * Execute a task - to be implemented by each satellite
   */
  abstract execute(task: SatelliteTask): Promise<SatelliteResult>

  /**
   * Get the satellite's system prompt
   */
  protected getSystemPrompt(): string {
    return `${this.config.systemPrompt}

You are ${this.config.name}, the ${this.config.role}.
Archetype: ${this.config.archetype}

Your capabilities:
${this.config.capabilities.map(c => `- ${c}`).join('\n')}

Always respond in a structured format and be precise in your outputs.`
  }

  /**
   * Generate a response using the LLM
   */
  protected async generate(
    prompt: string,
    context?: ChatMessage[]
  ): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.getSystemPrompt() },
      ...(context || []),
      { role: 'user', content: prompt },
    ]

    this.emitEvent('thinking', { prompt })

    const response = await this.llmService.chat({
      messages,
      temperature: this.config.temperature,
      maxTokens: 2048,
    })

    // Track token usage
    if (response.usage) {
      this.state.tokensUsed += response.usage.totalTokens
    }

    return response.content
  }

  /**
   * Generate with streaming
   */
  protected async *generateStream(
    prompt: string,
    context?: ChatMessage[]
  ): AsyncGenerator<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.getSystemPrompt() },
      ...(context || []),
      { role: 'user', content: prompt },
    ]

    this.emitEvent('thinking', { prompt })

    for await (const chunk of this.llmService.chatStream({
      messages,
      temperature: this.config.temperature,
    })) {
      yield chunk
    }
  }

  /**
   * Search Punk Records for relevant context
   */
  protected async searchContext(query: string, limit = 5): Promise<string> {
    const results = await this.punkRecords.search(query, { limit })

    if (results.length === 0) {
      return 'No relevant context found.'
    }

    return results
      .map((r, i) => `[${i + 1}] ${r.document.content}`)
      .join('\n\n')
  }

  /**
   * Store result in Punk Records
   */
  protected async storeResult(content: string, type: string): Promise<void> {
    await this.punkRecords.addDocument(content, {
      source: `satellite:${this.config.id}`,
      type: 'agent_output',
      title: `${this.config.name} Output`,
      tags: [this.config.id, type],
    })
  }

  /**
   * Create a successful result
   */
  protected createSuccessResult(
    taskId: string,
    output: string,
    artifacts?: Artifact[]
  ): SatelliteResult {
    const metrics = this.getCurrentMetrics()
    return {
      taskId,
      satelliteId: this.config.id,
      success: true,
      output,
      artifacts,
      metrics,
    }
  }

  /**
   * Create a failure result
   */
  protected createFailureResult(
    taskId: string,
    error: string
  ): SatelliteResult {
    const metrics = this.getCurrentMetrics()
    return {
      taskId,
      satelliteId: this.config.id,
      success: false,
      output: '',
      error,
      metrics,
    }
  }

  /**
   * Get current execution metrics
   */
  protected getCurrentMetrics(): ExecutionMetrics {
    const duration = this.state.startTime
      ? Date.now() - this.state.startTime
      : 0

    return {
      duration,
      tokensUsed: this.state.tokensUsed,
      iterationCount: this.state.iterations,
      toolCallCount: 0,
      memoryAccesses: 0,
    }
  }

  /**
   * Update satellite state
   */
  protected updateState(updates: Partial<SatelliteState>): void {
    this.state = { ...this.state, ...updates }
    this.emitEvent('executing', { state: this.state })
  }

  /**
   * Subscribe to satellite events
   */
  onEvent(callback: SatelliteEventCallback): () => void {
    this.eventCallbacks.push(callback)
    return () => {
      const index = this.eventCallbacks.indexOf(callback)
      if (index > -1) {
        this.eventCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Emit an event
   */
  protected emitEvent(type: SatelliteEventType, data: unknown): void {
    const event: SatelliteEvent = {
      type,
      satelliteId: this.config.id,
      data,
      timestamp: Date.now(),
    }
    this.eventCallbacks.forEach(cb => cb(event))
  }

  /**
   * Handle incoming message from another satellite
   */
  async handleMessage(message: SatelliteMessage): Promise<void> {
    const handler = this.messageHandlers.get(message.type)
    if (handler) {
      await handler(message)
    } else {
      logger.warn(`No handler for message type: ${message.type}`, {
        satellite: this.config.id,
      })
    }
  }

  /**
   * Send message to another satellite
   */
  protected createMessage(
    to: SatelliteId | 'broadcast',
    type: SatelliteMessage['type'],
    payload: unknown
  ): SatelliteMessage {
    return {
      id: uuidv4(),
      from: this.config.id,
      to,
      type,
      payload,
      timestamp: Date.now(),
    }
  }

  /**
   * Get current state
   */
  getState(): SatelliteState {
    return { ...this.state }
  }

  /**
   * Get configuration
   */
  getConfig(): SatelliteConfig {
    return { ...this.config }
  }

  /**
   * Reset satellite state
   */
  reset(): void {
    this.state = this.createInitialState()
  }
}

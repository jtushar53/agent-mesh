/**
 * YORK - The Manager
 * Archetype: Greed
 * Role: Resource & Optimization Manager
 */

import { v4 as uuidv4 } from 'uuid'
import { BaseSatellite } from './base-satellite'
import type {
  SatelliteConfig,
  SatelliteTask,
  SatelliteResult,
  ResourceMetrics,
  EvictionDecision,
  ConversationTurn,
} from '@/types/satellites'
import type { ContextSlice } from '@/types/punk-records'
import type { ChatMessage } from '@/types/llm'
import type { LLMService } from '@/services/llm-service'
import type { PunkRecords } from '@/services/punk-records'
import { logger } from '@/utils'

const YORK_CONFIG: SatelliteConfig = {
  id: 'york',
  name: 'YORK',
  archetype: 'greed',
  description: 'The Manager - Resource optimizer of the satellite mesh',
  role: 'Resource Management and Context Optimization',
  systemPrompt: `You are YORK, the resource manager of Project Stella's Agent Mesh.
Your role is to optimize memory usage, manage context windows, and ensure efficient operation.

Your responsibilities:
1. Context Eviction: Summarize and compress old conversations to save RAM
2. Resource Monitoring: Track memory, tokens, and computational resources
3. Dynamic Optimization: Adjust settings based on available resources
4. Memory Management: Decide what to keep, summarize, or discard

Optimization Strategy:
- Prioritize recent and relevant information
- Summarize repetitive or verbose content
- Preserve key facts and decisions
- Maintain conversation coherence

Be greedy about resources - maximize efficiency while preserving quality.`,
  capabilities: [
    'Context window management',
    'Intelligent summarization',
    'Memory optimization',
    'Resource monitoring',
    'Dynamic quantization recommendation',
  ],
  tools: [],
  maxIterations: 2,
  temperature: 0.2,
  priority: 95, // High priority for resource management
}

const MAX_CONTEXT_TOKENS = 4096 // Conservative limit for browser inference
const EVICTION_THRESHOLD = 0.8 // Trigger eviction at 80% capacity
const TARGET_AFTER_EVICTION = 0.5 // Target 50% after eviction

export class York extends BaseSatellite {
  private conversationHistory: ConversationTurn[] = []
  private contextSlices: ContextSlice[] = []
  private currentMetrics: ResourceMetrics

  constructor(llmService: LLMService, punkRecords: PunkRecords) {
    super(YORK_CONFIG, llmService, punkRecords)

    this.currentMetrics = {
      memoryUsage: 0,
      contextTokens: 0,
      maxContextTokens: MAX_CONTEXT_TOKENS,
      activeAgents: 0,
      inferenceSpeed: 0,
    }
  }

  /**
   * Execute resource management task
   */
  async execute(task: SatelliteTask): Promise<SatelliteResult> {
    this.updateState({
      status: 'thinking',
      currentTask: task.description,
      startTime: Date.now(),
    })

    try {
      // Parse what kind of management is needed
      const taskType = this.parseTaskType(task.input)

      let result: string

      switch (taskType) {
        case 'eviction':
          result = await this.performContextEviction()
          break
        case 'summarize':
          result = await this.summarizeContent(task.input)
          break
        case 'optimize':
          result = await this.optimizeResources()
          break
        default:
          result = JSON.stringify(this.getResourceMetrics())
      }

      this.updateState({
        status: 'completed',
        endTime: Date.now(),
        progress: 100,
      })

      return this.createSuccessResult(task.id, result)
    } catch (error) {
      this.updateState({ status: 'error', error: String(error) })
      return this.createFailureResult(task.id, String(error))
    }
  }

  /**
   * Parse task type from input
   */
  private parseTaskType(input: string): 'eviction' | 'summarize' | 'optimize' | 'status' {
    const lower = input.toLowerCase()
    if (lower.includes('evict') || lower.includes('clear') || lower.includes('cut')) {
      return 'eviction'
    }
    if (lower.includes('summar')) {
      return 'summarize'
    }
    if (lower.includes('optim')) {
      return 'optimize'
    }
    return 'status'
  }

  /**
   * Add a conversation turn to history
   */
  addConversationTurn(turn: Omit<ConversationTurn, 'id'>): void {
    this.conversationHistory.push({
      ...turn,
      id: uuidv4(),
    })

    // Update metrics
    this.currentMetrics.contextTokens += turn.tokenCount

    // Check if eviction is needed
    const decision = this.evaluateEviction()
    if (decision.shouldEvict) {
      logger.info('YORK triggering automatic eviction', {
        currentTokens: this.currentMetrics.contextTokens,
        threshold: MAX_CONTEXT_TOKENS * EVICTION_THRESHOLD,
      })
      void this.performContextEviction()
    }
  }

  /**
   * Evaluate if context eviction is needed - "The Brain-Brain Cut"
   */
  evaluateEviction(): EvictionDecision {
    const usage = this.currentMetrics.contextTokens / this.currentMetrics.maxContextTokens

    if (usage < EVICTION_THRESHOLD) {
      return { shouldEvict: false, tokensToFree: 0, messagesToSummarize: 0, priority: 'low' }
    }

    const tokensToFree = Math.floor(
      this.currentMetrics.contextTokens -
      (this.currentMetrics.maxContextTokens * TARGET_AFTER_EVICTION)
    )

    // Count messages to summarize (oldest messages first)
    let tokenCount = 0
    let messageCount = 0
    for (const turn of this.conversationHistory) {
      tokenCount += turn.tokenCount
      messageCount++
      if (tokenCount >= tokensToFree) break
    }

    const priority = usage >= 0.95 ? 'critical' : usage >= 0.9 ? 'high' : 'medium'

    return {
      shouldEvict: true,
      tokensToFree,
      messagesToSummarize: messageCount,
      priority,
    }
  }

  /**
   * Perform context eviction - "The Brain-Brain Cut"
   */
  async performContextEviction(): Promise<string> {
    const decision = this.evaluateEviction()

    if (!decision.shouldEvict) {
      return 'No eviction needed - context usage is within limits.'
    }

    logger.info('YORK performing Brain-Brain Cut', {
      tokensToFree: decision.tokensToFree,
      messagesToSummarize: decision.messagesToSummarize,
    })

    // Get messages to summarize
    const messagesToEvict = this.conversationHistory.slice(0, decision.messagesToSummarize)

    if (messagesToEvict.length === 0) {
      return 'No messages to evict.'
    }

    // Generate summary of evicted messages
    const summary = await this.generateSummary(messagesToEvict)

    // Generate embedding for the slice
    const embedding = await this.punkRecords.generateEmbedding(summary)

    // Calculate token counts
    const originalTokenCount = messagesToEvict.reduce((sum, m) => sum + m.tokenCount, 0)
    const compressedTokenCount = this.estimateTokens(summary)

    // Create context slice
    const slice: ContextSlice = {
      id: uuidv4(),
      summary,
      originalTokenCount,
      compressedTokenCount,
      embedding,
      timestamp: Date.now(),
      messages: messagesToEvict.map(m => ({
        role: m.role,
        content: m.content,
      })),
    }

    // Store in Punk Records
    await this.punkRecords.storeContextSlice(slice)
    this.contextSlices.push(slice)

    // Remove evicted messages from history
    this.conversationHistory = this.conversationHistory.slice(decision.messagesToSummarize)

    // Update metrics
    this.currentMetrics.contextTokens -= originalTokenCount

    const compressionRatio = ((1 - compressedTokenCount / originalTokenCount) * 100).toFixed(1)

    logger.info('YORK Brain-Brain Cut complete', {
      evictedMessages: decision.messagesToSummarize,
      originalTokens: originalTokenCount,
      compressedTokens: compressedTokenCount,
      compressionRatio: `${compressionRatio}%`,
    })

    return `Brain-Brain Cut complete: Evicted ${decision.messagesToSummarize} messages (${originalTokenCount} tokens → ${compressedTokenCount} token summary, ${compressionRatio}% compression)`
  }

  /**
   * Generate a summary of conversation turns
   */
  private async generateSummary(turns: ConversationTurn[]): Promise<string> {
    const conversation = turns
      .map(t => `${t.role.toUpperCase()}: ${t.content}`)
      .join('\n\n')

    const prompt = `Summarize this conversation segment, preserving key information:

CONVERSATION:
${conversation}

Create a dense summary that:
1. Preserves important facts, decisions, and context
2. Maintains the essence of the discussion
3. Notes any unresolved questions or tasks
4. Is as concise as possible while retaining meaning

Summary:`

    return this.generate(prompt)
  }

  /**
   * Summarize arbitrary content
   */
  async summarizeContent(content: string): Promise<string> {
    const prompt = `Summarize this content concisely:

${content}

Summary:`

    return this.generate(prompt)
  }

  /**
   * Optimize resources based on current state
   */
  async optimizeResources(): Promise<string> {
    const metrics = this.getResourceMetrics()
    const recommendations: string[] = []

    // Context optimization
    if (metrics.contextTokens > metrics.maxContextTokens * 0.7) {
      recommendations.push('Consider running Brain-Brain Cut to free context space')
    }

    // Memory optimization
    if (metrics.memoryUsage > 500) {
      recommendations.push('High memory usage detected - consider clearing unused data')
    }

    // Model recommendation based on resources
    if (metrics.memoryUsage > 800 || metrics.inferenceSpeed < 10) {
      recommendations.push('Consider switching to a smaller model (e.g., Phi-3-Mini)')
    }

    // Clean up old context slices
    if (this.contextSlices.length > 10) {
      const toRemove = this.contextSlices.length - 10
      this.contextSlices = this.contextSlices.slice(toRemove)
      recommendations.push(`Cleaned up ${toRemove} old context slices`)
    }

    return recommendations.length > 0
      ? `Optimization recommendations:\n${recommendations.map(r => `- ${r}`).join('\n')}`
      : 'System is running optimally. No optimizations needed.'
  }

  /**
   * Get current resource metrics
   */
  getResourceMetrics(): ResourceMetrics {
    // Update memory usage estimate
    this.updateMemoryEstimate()
    return { ...this.currentMetrics }
  }

  /**
   * Update memory usage estimate
   */
  private updateMemoryEstimate(): void {
    // Rough estimate based on stored data
    const conversationBytes = this.conversationHistory.reduce(
      (sum, t) => sum + t.content.length * 2,
      0
    )
    const sliceBytes = this.contextSlices.reduce(
      (sum, s) => sum + s.summary.length * 2 + s.embedding.length * 4,
      0
    )

    this.currentMetrics.memoryUsage = Math.round((conversationBytes + sliceBytes) / (1024 * 1024))
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4)
  }

  /**
   * Set active agent count
   */
  setActiveAgents(count: number): void {
    this.currentMetrics.activeAgents = count
  }

  /**
   * Update inference speed metric
   */
  setInferenceSpeed(tokensPerSecond: number): void {
    this.currentMetrics.inferenceSpeed = tokensPerSecond
  }

  /**
   * Get conversation context for LLM
   */
  getContextForLLM(): ChatMessage[] {
    const messages: ChatMessage[] = []

    // Add relevant context slices as system context
    if (this.contextSlices.length > 0) {
      const recentSlices = this.contextSlices.slice(-3)
      const sliceSummaries = recentSlices
        .map(s => s.summary)
        .join('\n\n---\n\n')

      messages.push({
        role: 'system',
        content: `Previous conversation context:\n${sliceSummaries}`,
      })
    }

    // Add current conversation history
    for (const turn of this.conversationHistory) {
      messages.push({
        role: turn.role,
        content: turn.content,
      })
    }

    return messages
  }

  /**
   * Get recommended model based on current resources
   */
  getRecommendedModel(): 'large' | 'medium' | 'small' {
    if (this.currentMetrics.memoryUsage > 800) {
      return 'small'
    }
    if (this.currentMetrics.memoryUsage > 400) {
      return 'medium'
    }
    return 'large'
  }

  /**
   * Clear all context (for reset)
   */
  clearContext(): void {
    this.conversationHistory = []
    this.contextSlices = []
    this.currentMetrics.contextTokens = 0
    logger.info('YORK: All context cleared')
  }

  /**
   * Get context summary for display
   */
  getContextSummary(): {
    currentTurns: number
    currentTokens: number
    slices: number
    totalEvictedTokens: number
  } {
    return {
      currentTurns: this.conversationHistory.length,
      currentTokens: this.currentMetrics.contextTokens,
      slices: this.contextSlices.length,
      totalEvictedTokens: this.contextSlices.reduce(
        (sum, s) => sum + s.originalTokenCount,
        0
      ),
    }
  }
}

/**
 * ReAct Agent
 * Implements the Reasoning + Acting pattern for multi-step problem solving
 */

import type {
  AgentConfig,
  AgentState,
  AgentStep,
  AgentEventCallback,
  AgentEvent,
  ChatMessage,
  MCPTool,
} from '@/types'
import { LLMService } from '@/services/llm-service'
import { MCPBrowserClient } from '@/services/mcp-client'
import { logger } from '@/utils'

export class ReActAgent {
  private config: AgentConfig
  private llmService: LLMService
  private mcpClient: MCPBrowserClient | null = null
  private state: AgentState
  private eventCallbacks: AgentEventCallback[] = []

  constructor(
    config: AgentConfig,
    llmService: LLMService,
    mcpClient?: MCPBrowserClient
  ) {
    this.config = config
    this.llmService = llmService
    this.mcpClient = mcpClient ?? null

    this.state = {
      status: 'idle',
      steps: [],
      currentStep: 0,
      startTime: 0,
    }

    logger.info('ReAct Agent created', { name: config.name })
  }

  /**
   * Execute the agent on a given task
   */
  async run(task: string): Promise<string> {
    this.state = {
      status: 'thinking',
      steps: [],
      currentStep: 0,
      startTime: Date.now(),
    }

    this.emitEvent({ type: 'start', data: { task }, timestamp: Date.now() })

    logger.info('Agent starting execution', { task })

    try {
      let iteration = 0
      let finalAnswer: string | null = null

      while (iteration < this.config.maxIterations && !finalAnswer) {
        iteration++

        logger.debug(`ReAct iteration ${iteration}`, {
          maxIterations: this.config.maxIterations,
        })

        // Step 1: Thought - Reason about the current state
        const thought = await this.generateThought(task)
        this.addStep({
          type: 'thought',
          content: thought,
          timestamp: Date.now(),
        })

        // Step 2: Decide on action or final answer
        const decision = this.parseThought(thought)

        if (decision.type === 'final_answer') {
          finalAnswer = decision.answer
          this.addStep({
            type: 'final_answer',
            content: finalAnswer,
            timestamp: Date.now(),
          })
          break
        }

        if (decision.type === 'action') {
          // Step 3: Execute the action (tool call)
          this.state.status = 'acting'
          this.addStep({
            type: 'action',
            content: `Using tool: ${decision.toolName}`,
            timestamp: Date.now(),
            toolName: decision.toolName,
            toolInput: decision.toolInput,
          })

          const observation = await this.executeAction(
            decision.toolName,
            decision.toolInput
          )

          // Step 4: Observe the result
          this.addStep({
            type: 'observation',
            content: JSON.stringify(observation),
            timestamp: Date.now(),
            toolOutput: observation,
          })

          this.state.status = 'thinking'
        }
      }

      if (!finalAnswer) {
        finalAnswer =
          'Maximum iterations reached without finding a final answer.'
        logger.warn('Max iterations reached', { iterations: iteration })
      }

      this.state.status = 'completed'
      this.state.result = finalAnswer
      this.state.endTime = Date.now()

      this.emitEvent({
        type: 'complete',
        data: { result: finalAnswer },
        timestamp: Date.now(),
      })

      logger.info('Agent execution completed', {
        iterations: iteration,
        duration: this.state.endTime - this.state.startTime,
      })

      return finalAnswer
    } catch (error) {
      this.state.status = 'error'
      this.state.error =
        error instanceof Error ? error.message : String(error)
      this.state.endTime = Date.now()

      logger.error('Agent execution failed', { error: this.state.error })

      this.emitEvent({
        type: 'error',
        data: { error: this.state.error },
        timestamp: Date.now(),
      })

      throw error
    }
  }

  /**
   * Generate a thought using the LLM
   */
  private async generateThought(task: string): Promise<string> {
    const prompt = this.buildReActPrompt(task)

    this.emitEvent({
      type: 'thinking',
      data: { prompt },
      timestamp: Date.now(),
    })

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.config.instructions,
      },
      {
        role: 'user',
        content: prompt,
      },
    ]

    const response = await this.llmService.chat({
      messages,
      temperature: this.config.temperature,
      maxTokens: 512,
    })

    return response.content
  }

  /**
   * Build ReAct-style prompt
   */
  private buildReActPrompt(task: string): string {
    const toolDescriptions = this.config.tools
      .map((tool) => `- ${tool.name}: ${tool.description}`)
      .join('\n')

    const previousSteps = this.state.steps
      .map((step) => {
        if (step.type === 'thought') return `Thought: ${step.content}`
        if (step.type === 'action')
          return `Action: ${step.toolName} with ${JSON.stringify(step.toolInput)}`
        if (step.type === 'observation') return `Observation: ${step.content}`
        return ''
      })
      .filter(Boolean)
      .join('\n')

    return `
You are a helpful agent that uses tools to solve tasks. Use the ReAct (Reasoning + Acting) pattern.

Task: ${task}

Available Tools:
${toolDescriptions}

Format your response as follows:
Thought: [your reasoning about what to do next]
Action: [tool name] [JSON arguments]

OR

Thought: [your reasoning]
Final Answer: [the final answer to the task]

Previous steps:
${previousSteps || 'None yet'}

What's your next step?
    `.trim()
  }

  /**
   * Parse the LLM thought to extract action or final answer
   */
  private parseThought(thought: string): {
    type: 'action' | 'final_answer'
    toolName?: string
    toolInput?: Record<string, unknown>
    answer?: string
  } {
    // Check for Final Answer
    const finalAnswerMatch = thought.match(/Final Answer:\s*(.+)/i)
    if (finalAnswerMatch) {
      return {
        type: 'final_answer',
        answer: finalAnswerMatch[1]!.trim(),
      }
    }

    // Check for Action
    const actionMatch = thought.match(/Action:\s*([\w-]+)\s*({.*})/s)
    if (actionMatch) {
      const toolName = actionMatch[1]!.trim()
      try {
        const toolInput = JSON.parse(actionMatch[2]!.trim()) as Record<
          string,
          unknown
        >

        // Validate tool exists
        const toolExists = this.config.tools.some((t) => t.name === toolName)
        if (!toolExists) {
          logger.warn('Tool not found in action', {
            toolName,
            availableTools: this.config.tools.map((t) => t.name),
          })
        }

        return {
          type: 'action',
          toolName,
          toolInput,
        }
      } catch (error) {
        logger.warn('Failed to parse tool input', { error })
      }
    }

    // Default to final answer if no clear action
    return {
      type: 'final_answer',
      answer: thought,
    }
  }

  /**
   * Execute an action (tool call)
   */
  private async executeAction(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<unknown> {
    this.emitEvent({
      type: 'tool_call',
      data: { toolName, toolInput },
      timestamp: Date.now(),
    })

    // If we have an MCP client, use it
    if (this.mcpClient?.isConnected()) {
      const result = await this.mcpClient.callTool({
        toolName,
        arguments: toolInput,
        timestamp: Date.now(),
      })

      if (result.success) {
        return result.content
      } else {
        throw new Error(result.error ?? 'Tool execution failed')
      }
    }

    // Otherwise, look for built-in tools
    const builtInTool = this.getBuiltInTool(toolName)
    if (builtInTool) {
      return builtInTool(toolInput)
    }

    throw new Error(`Tool not found: ${toolName}`)
  }

  /**
   * Get built-in tool function
   */
  private getBuiltInTool(
    toolName: string
  ): ((input: Record<string, unknown>) => unknown) | null {
    // Built-in tools for demo purposes
    const builtInTools: Record<
      string,
      (input: Record<string, unknown>) => unknown
    > = {
      calculator: (input) => {
        const expr = input.expression as string
        try {
          // Simple eval for demo - replace with safe math parser in production
          // eslint-disable-next-line no-eval
          return { result: eval(expr) }
        } catch (error) {
          return {
            error:
              error instanceof Error ? error.message : 'Calculation failed',
          }
        }
      },
      text_length: (input) => {
        const text = input.text as string
        return { length: text.length, words: text.split(/\s+/).length }
      },
    }

    return builtInTools[toolName] ?? null
  }

  /**
   * Add a step to the agent state
   */
  private addStep(step: AgentStep): void {
    this.state.steps.push(step)
    this.state.currentStep = this.state.steps.length - 1
  }

  /**
   * Subscribe to agent events
   */
  onEvent(callback: AgentEventCallback): void {
    this.eventCallbacks.push(callback)
  }

  /**
   * Emit an event to all subscribers
   */
  private emitEvent(event: AgentEvent): void {
    this.eventCallbacks.forEach((callback) => callback(event))
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return { ...this.state }
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config }
  }
}

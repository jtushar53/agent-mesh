/**
 * ATLAS - The Warrior
 * Archetype: Violence (Action)
 * Role: The Tool Executor. Interface between AI and external world.
 */

import { v4 as uuidv4 } from 'uuid'
import { BaseSatellite } from './base-satellite'
import type {
  SatelliteConfig,
  SatelliteTask,
  SatelliteResult,
  ToolExecutionRequest,
  DenDenMushiState,
} from '@/types/satellites'
import type { MCPTool, MCPToolResult } from '@/types/mcp'
import type { LLMService } from '@/services/llm-service'
import type { PunkRecords } from '@/services/punk-records'
import type { MCPBrowserClient } from '@/services/mcp-client'
import { logger } from '@/utils'

const ATLAS_CONFIG: SatelliteConfig = {
  id: 'atlas',
  name: 'ATLAS',
  archetype: 'violence',
  description: 'The Warrior - Tool Executor of the satellite mesh',
  role: 'Tool Execution and External Interface',
  systemPrompt: `You are ATLAS, the warrior of Project Stella's Agent Mesh.
Your role is to execute tools and interface with the external world through MCP.

Your responsibilities:
1. Tool Selection: Choose the right tool for each task
2. Parameter Preparation: Correctly format tool inputs
3. Execution: Call tools through MCP protocol
4. Error Handling: Analyze errors and retry with corrections
5. Result Processing: Parse and validate tool outputs

Error Recovery Strategy:
- For 4xx errors: Check and fix input parameters
- For 5xx errors: Retry with exponential backoff
- For timeout: Retry with longer timeout
- For unknown errors: Report with full context

Always log all tool executions for traceability.`,
  capabilities: [
    'MCP tool execution',
    'Automatic error recovery',
    'Parameter validation',
    'Result parsing',
    'Rate limiting',
  ],
  tools: [],
  maxIterations: 5,
  temperature: 0.1,
  priority: 85,
}

interface ToolExecutionResult {
  success: boolean
  output: unknown
  error?: string | undefined
  attempts: number
  totalDuration: number
}

export class Atlas extends BaseSatellite {
  private mcpClient: MCPBrowserClient | null = null
  private connectionState: DenDenMushiState = 'sleep'
  private executionHistory: Array<{
    toolName: string
    success: boolean
    duration: number
    timestamp: number
  }> = []

  constructor(llmService: LLMService, punkRecords: PunkRecords) {
    super(ATLAS_CONFIG, llmService, punkRecords)
  }

  /**
   * Set MCP client for tool execution
   */
  setMCPClient(client: MCPBrowserClient): void {
    this.mcpClient = client
    this.connectionState = client.isConnected() ? 'signal' : 'sleep'
    logger.info('ATLAS MCP client configured', {
      connected: client.isConnected(),
    })
  }

  /**
   * Get Den Den Mushi connection state
   */
  getConnectionState(): DenDenMushiState {
    return this.connectionState
  }

  /**
   * Execute tool task
   */
  async execute(task: SatelliteTask): Promise<SatelliteResult> {
    this.updateState({
      status: 'executing',
      currentTask: task.description,
      startTime: Date.now(),
    })

    try {
      // Parse tool execution request from task
      const request = await this.parseToolRequest(task.input)

      if (!request) {
        return this.createFailureResult(
          task.id,
          'Could not determine tool to execute from task input'
        )
      }

      // Execute the tool
      const result = await this.executeToolWithRetry(request)

      this.updateState({
        status: 'completed',
        endTime: Date.now(),
        progress: 100,
      })

      if (result.success) {
        return this.createSuccessResult(
          task.id,
          JSON.stringify(result.output),
          [
            {
              id: uuidv4(),
              type: 'data',
              content: JSON.stringify(result.output),
              metadata: {
                type: 'tool_result',
                toolName: request.toolName,
                attempts: result.attempts,
                duration: result.totalDuration,
              },
            },
          ]
        )
      } else {
        return this.createFailureResult(task.id, result.error || 'Tool execution failed')
      }
    } catch (error) {
      this.updateState({ status: 'error', error: String(error) })
      return this.createFailureResult(task.id, String(error))
    }
  }

  /**
   * Parse tool request from natural language input
   */
  private async parseToolRequest(input: string): Promise<ToolExecutionRequest | null> {
    // Get available tools
    const tools = this.getAvailableTools()

    if (tools.length === 0) {
      logger.warn('No tools available for execution')
      return null
    }

    const toolDescriptions = tools
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n')

    const prompt = `Determine which tool to use and what arguments to pass:

TASK: ${input}

AVAILABLE TOOLS:
${toolDescriptions}

Respond in JSON format:
{
  "toolName": "name of the tool to use",
  "arguments": { "arg1": "value1", "arg2": "value2" },
  "reasoning": "why this tool and these arguments"
}

If no tool is suitable, respond with:
{ "toolName": null, "reasoning": "explanation" }`

    const response = await this.generate(prompt)
    this.state.iterations++

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          toolName: string | null
          arguments?: Record<string, unknown>
        }

        if (!parsed.toolName) {
          return null
        }

        return {
          toolName: parsed.toolName,
          arguments: parsed.arguments || {},
          retryCount: 0,
          maxRetries: 3,
          timeout: 30000,
        }
      }
    } catch (error) {
      logger.error('Failed to parse tool request', { error })
    }

    return null
  }

  /**
   * Execute tool with retry logic
   */
  private async executeToolWithRetry(
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now()
    let lastError: string | undefined
    let attempt = 0

    while (attempt <= request.maxRetries) {
      attempt++
      this.connectionState = 'call'
      this.emitEvent('executing', { tool: request.toolName, attempt })

      try {
        const result = await this.callTool(request.toolName, request.arguments)

        // Record success
        this.recordExecution(request.toolName, true, Date.now() - startTime)
        this.connectionState = 'signal'

        return {
          success: result.success,
          output: result.content,
          error: result.error,
          attempts: attempt,
          totalDuration: Date.now() - startTime,
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        logger.warn('Tool execution failed, attempting recovery', {
          tool: request.toolName,
          attempt,
          error: lastError,
        })

        // Analyze error and decide on retry strategy
        const shouldRetry = this.analyzeErrorForRetry(lastError, attempt, request.maxRetries)

        if (!shouldRetry) {
          break
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))

        // Try to fix arguments if it was a parameter error
        if (this.isParameterError(lastError)) {
          const fixedArgs = await this.attemptParameterFix(
            request.toolName,
            request.arguments,
            lastError
          )
          if (fixedArgs) {
            request.arguments = fixedArgs
          }
        }
      }
    }

    // Record failure
    this.recordExecution(request.toolName, false, Date.now() - startTime)
    this.connectionState = 'sleep'

    return {
      success: false,
      output: null,
      error: lastError || 'Unknown error',
      attempts: attempt,
      totalDuration: Date.now() - startTime,
    }
  }

  /**
   * Call tool through MCP client
   */
  private async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    if (!this.mcpClient?.isConnected()) {
      // Fall back to built-in tools
      return this.executeBuiltInTool(toolName, args)
    }

    return this.mcpClient.callTool({
      toolName,
      arguments: args,
      timestamp: Date.now(),
    })
  }

  /**
   * Execute built-in tools when MCP is not available
   */
  private async executeBuiltInTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const startTime = Date.now()

    const builtInTools: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
      // Calculator tool
      calculate: async (input) => {
        const expression = input.expression as string
        try {
          // Safe math evaluation using Function
          const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '')
          // eslint-disable-next-line no-new-func
          const result = new Function(`return ${sanitized}`)()
          return { result }
        } catch (error) {
          throw new Error(`Invalid expression: ${expression}`)
        }
      },

      // Current time tool
      get_time: async () => {
        return {
          timestamp: Date.now(),
          iso: new Date().toISOString(),
          local: new Date().toLocaleString(),
        }
      },

      // UUID generator
      generate_uuid: async () => {
        return { uuid: uuidv4() }
      },

      // Text analysis
      analyze_text: async (input) => {
        const text = input.text as string
        return {
          length: text.length,
          words: text.split(/\s+/).length,
          sentences: text.split(/[.!?]+/).length,
          paragraphs: text.split(/\n\n+/).length,
        }
      },

      // JSON validation
      validate_json: async (input) => {
        const jsonString = input.json as string
        try {
          JSON.parse(jsonString)
          return { valid: true }
        } catch (error) {
          return { valid: false, error: String(error) }
        }
      },
    }

    const tool = builtInTools[toolName]
    if (!tool) {
      return {
        success: false,
        content: null,
        error: `Unknown tool: ${toolName}`,
        executionTime: Date.now() - startTime,
      }
    }

    try {
      const result = await tool(args)
      return {
        success: true,
        content: result,
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        content: null,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      }
    }
  }

  /**
   * Get list of available tools
   */
  getAvailableTools(): MCPTool[] {
    // Get MCP tools
    const mcpTools = this.mcpClient?.getTools() || []

    // Add built-in tools
    const builtInTools: MCPTool[] = [
      {
        name: 'calculate',
        description: 'Evaluate a mathematical expression',
        inputSchema: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Math expression to evaluate' },
          },
          required: ['expression'],
        },
      },
      {
        name: 'get_time',
        description: 'Get the current time',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'generate_uuid',
        description: 'Generate a random UUID',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'analyze_text',
        description: 'Analyze text for length, words, sentences, etc.',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to analyze' },
          },
          required: ['text'],
        },
      },
      {
        name: 'validate_json',
        description: 'Validate if a string is valid JSON',
        inputSchema: {
          type: 'object',
          properties: {
            json: { type: 'string', description: 'JSON string to validate' },
          },
          required: ['json'],
        },
      },
    ]

    return [...mcpTools, ...builtInTools]
  }

  /**
   * Analyze error to determine if retry is appropriate
   */
  private analyzeErrorForRetry(
    error: string,
    attempt: number,
    maxRetries: number
  ): boolean {
    if (attempt >= maxRetries) return false

    // Server errors are retriable
    if (error.includes('500') || error.includes('502') || error.includes('503')) {
      return true
    }

    // Timeout is retriable
    if (error.includes('timeout') || error.includes('ETIMEDOUT')) {
      return true
    }

    // Connection errors are retriable
    if (error.includes('ECONNREFUSED') || error.includes('ENOTFOUND')) {
      return true
    }

    // Rate limiting is retriable
    if (error.includes('429') || error.includes('rate limit')) {
      return true
    }

    // Client errors (4xx) are generally not retriable without changes
    if (error.includes('400') || error.includes('401') || error.includes('403')) {
      return false
    }

    return true // Default to retry
  }

  /**
   * Check if error is related to parameters
   */
  private isParameterError(error: string): boolean {
    const parameterErrorPatterns = [
      'invalid parameter',
      'missing required',
      'type error',
      'validation failed',
      'invalid argument',
    ]

    return parameterErrorPatterns.some(p =>
      error.toLowerCase().includes(p.toLowerCase())
    )
  }

  /**
   * Attempt to fix parameters based on error
   */
  private async attemptParameterFix(
    toolName: string,
    currentArgs: Record<string, unknown>,
    error: string
  ): Promise<Record<string, unknown> | null> {
    const tool = this.getAvailableTools().find(t => t.name === toolName)
    if (!tool) return null

    const prompt = `Fix the tool parameters based on this error:

TOOL: ${toolName}
SCHEMA: ${JSON.stringify(tool.inputSchema)}
CURRENT ARGUMENTS: ${JSON.stringify(currentArgs)}
ERROR: ${error}

Return the corrected arguments as JSON, or null if unfixable.`

    const response = await this.generate(prompt)
    this.state.iterations++

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch && jsonMatch[0] !== 'null') {
        return JSON.parse(jsonMatch[0]) as Record<string, unknown>
      }
    } catch {
      // Parsing failed
    }

    return null
  }

  /**
   * Record tool execution for analytics
   */
  private recordExecution(
    toolName: string,
    success: boolean,
    duration: number
  ): void {
    this.executionHistory.push({
      toolName,
      success,
      duration,
      timestamp: Date.now(),
    })

    // Keep only last 100 executions
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-100)
    }
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    totalExecutions: number
    successRate: number
    averageDuration: number
  } {
    if (this.executionHistory.length === 0) {
      return { totalExecutions: 0, successRate: 0, averageDuration: 0 }
    }

    const total = this.executionHistory.length
    const successful = this.executionHistory.filter(e => e.success).length
    const totalDuration = this.executionHistory.reduce((sum, e) => sum + e.duration, 0)

    return {
      totalExecutions: total,
      successRate: successful / total,
      averageDuration: totalDuration / total,
    }
  }
}

/**
 * MCP Browser Client
 * Implements Model Context Protocol client for browser environments
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type {
  MCPServerConfig,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPSession,
  MCPToolCall,
  MCPToolResult,
  MCPConnectionStatus,
  MCPError,
} from '@/types'
import { logger } from '@/utils'

export class MCPBrowserClient {
  private client: Client
  private transport: StreamableHTTPClientTransport | null = null
  private serverConfig: MCPServerConfig
  private session: MCPSession | null = null
  private connectionStatus: MCPConnectionStatus = 'disconnected'
  private retryCount = 0
  private maxRetries = 3

  constructor(serverConfig: MCPServerConfig) {
    this.serverConfig = serverConfig
    this.client = new Client({
      name: 'agentmesh-browser-client',
      version: '0.1.0',
    })

    logger.info('MCP Browser Client initialized', {
      server: serverConfig.name,
      url: serverConfig.url,
    })
  }

  /**
   * Connect to MCP server
   */
  async connect(): Promise<void> {
    if (this.connectionStatus === 'connected') {
      logger.warn('Already connected to MCP server')
      return
    }

    this.connectionStatus = 'connecting'
    logger.info('Connecting to MCP server', { url: this.serverConfig.url })

    try {
      this.transport = new StreamableHTTPClientTransport(
        new URL(this.serverConfig.url)
      )

      await this.client.connect(this.transport as any)

      // List available tools, resources, and prompts
      const [toolsResponse, resourcesResponse, promptsResponse] =
        await Promise.all([
          this.listTools(),
          this.listResources(),
          this.listPrompts(),
        ])

      // Create session object
      this.session = {
        sessionId: this.generateSessionId(),
        serverUrl: this.serverConfig.url,
        connected: true,
        tools: toolsResponse,
        resources: resourcesResponse,
        prompts: promptsResponse,
        capabilities: {
          tools: toolsResponse.length > 0,
          resources: resourcesResponse.length > 0,
          prompts: promptsResponse.length > 0,
        },
      }

      this.connectionStatus = 'connected'
      this.retryCount = 0

      logger.info('Successfully connected to MCP server', {
        tools: toolsResponse.length,
        resources: resourcesResponse.length,
        prompts: promptsResponse.length,
      })
    } catch (error) {
      this.connectionStatus = 'error'
      const mcpError: MCPError = {
        code: 'CONNECTION_FAILED',
        message: `Failed to connect to MCP server: ${error instanceof Error ? error.message : String(error)}`,
        details: error,
      }

      logger.error('MCP connection failed', {
        error: mcpError.message,
        attempt: this.retryCount + 1,
      })

      // Retry logic
      if (this.retryCount < this.maxRetries) {
        this.retryCount++
        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000)
        logger.info(`Retrying connection in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.connect()
      }

      throw mcpError
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (this.transport) {
      try {
        await this.transport.close()
        this.transport = null
        this.session = null
        this.connectionStatus = 'disconnected'
        logger.info('Disconnected from MCP server')
      } catch (error) {
        logger.error('Error disconnecting from MCP server', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  /**
   * List available tools from MCP server
   */
  async listTools(): Promise<MCPTool[]> {
    try {
      const response = await this.client.listTools()
      return response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? '',
        inputSchema: tool.inputSchema,
      }))
    } catch (error) {
      logger.error('Failed to list tools', {
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * List available resources from MCP server
   */
  async listResources(): Promise<MCPResource[]> {
    try {
      const response = await this.client.listResources()
      return response.resources.map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description ?? '',
        mimeType: resource.mimeType ?? '',
      }))
    } catch (error) {
      logger.error('Failed to list resources', {
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * List available prompts from MCP server
   */
  async listPrompts(): Promise<MCPPrompt[]> {
    try {
      const response = await this.client.listPrompts()
      return response.prompts.map((prompt) => ({
        name: prompt.name,
        description: prompt.description ?? '',
        arguments: (prompt.arguments as any) ?? {},
      }))
    } catch (error) {
      logger.error('Failed to list prompts', {
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    const startTime = Date.now()

    if (!this.session?.connected) {
      throw new Error('Not connected to MCP server')
    }

    logger.info('Calling MCP tool', {
      tool: toolCall.toolName,
      args: toolCall.arguments,
    })

    try {
      const result = await this.client.callTool({
        name: toolCall.toolName,
        arguments: toolCall.arguments,
      })

      const executionTime = Date.now() - startTime

      // Parse result content
      let content: unknown
      const resultContent = result.content as any[]
      if (resultContent && resultContent.length > 0) {
        const firstContent = resultContent[0]
        if (firstContent && 'text' in firstContent) {
          try {
            content = JSON.parse(firstContent.text)
          } catch {
            content = firstContent.text
          }
        } else {
          content = resultContent
        }
      }

      logger.info('Tool call successful', {
        tool: toolCall.toolName,
        executionTime,
      })

      return {
        success: !result.isError,
        content,
        executionTime,
      }
    } catch (error) {
      const executionTime = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      logger.error('Tool call failed', {
        tool: toolCall.toolName,
        error: errorMessage,
      })

      return {
        success: false,
        content: null,
        error: errorMessage,
        executionTime,
      }
    }
  }

  /**
   * Get current session
   */
  getSession(): MCPSession | null {
    return this.session
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): MCPConnectionStatus {
    return this.connectionStatus
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected' && this.session !== null
  }

  /**
   * Get available tools
   */
  getTools(): MCPTool[] {
    return this.session?.tools ?? []
  }

  /**
   * Get tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.session?.tools.find((tool) => tool.name === name)
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }
}

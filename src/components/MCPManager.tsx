/**
 * MCP Connection Manager
 * UI for connecting to MCP servers and testing tools
 * Supports both single server and JSON bulk configuration
 */

import { useState } from 'react'
import { MCPBrowserClient } from '@/services'
import { useAppStore } from '@/store'
import type { MCPServerConfig, MCPTool } from '@/types'
import './MCPManager.css'

interface MCPServersConfig {
  mcpServers: Record<
    string,
    {
      url: string
      description?: string
    }
  >
}

const DEFAULT_CONFIG: MCPServersConfig = {
  mcpServers: {
    'demo-server': {
      url: 'http://localhost:3001/mcp',
      description: 'Demo MCP server with basic tools (calculator, time, text)',
    },
  },
}

export function MCPManager() {
  const [configMode, setConfigMode] = useState<'single' | 'json'>('single')
  const [serverUrl, setServerUrl] = useState('http://localhost:3001/mcp')
  const [serverName, setServerName] = useState('demo-server')
  const [jsonConfig, setJsonConfig] = useState(
    JSON.stringify(DEFAULT_CONFIG, null, 2)
  )
  const [clients, setClients] = useState<
    Map<string, MCPBrowserClient>
  >(new Map())
  const [isConnecting, setIsConnecting] = useState(false)
  const [allTools, setAllTools] = useState<
    Map<string, { tool: MCPTool; serverName: string }>
  >(new Map())
  const [selectedTool, setSelectedTool] = useState<string>('')
  const [toolInput, setToolInput] = useState('')
  const [toolResult, setToolResult] = useState<any>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { addMCPSession, removeMCPSession, addMCPClient } = useAppStore()

  const handleConnectSingle = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      const config: MCPServerConfig = {
        name: serverName,
        url: serverUrl,
        enabled: true,
      }

      const mcpClient = new MCPBrowserClient(config)
      await mcpClient.connect()

      const session = mcpClient.getSession()
      if (session) {
        addMCPSession(session)
        addMCPClient(session.sessionId, mcpClient)

        // Update local state
        const newClients = new Map(clients)
        newClients.set(serverName, mcpClient)
        setClients(newClients)

        // Add tools to global map
        const newTools = new Map(allTools)
        session.tools.forEach((tool) => {
          newTools.set(`${serverName}:${tool.name}`, {
            tool,
            serverName,
          })
        })
        setAllTools(newTools)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsConnecting(false)
    }
  }

  const handleConnectFromJSON = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      const config: MCPServersConfig = JSON.parse(jsonConfig)

      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        throw new Error(
          'Invalid JSON format. Expected { "mcpServers": { ... } }'
        )
      }

      const newClients = new Map(clients)
      const newTools = new Map(allTools)

      // Connect to each server
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        try {
          const mcpConfig: MCPServerConfig = {
            name,
            url: serverConfig.url,
            ...(serverConfig.description && {
              description: serverConfig.description,
            }),
            enabled: true,
          }

          const mcpClient = new MCPBrowserClient(mcpConfig)
          await mcpClient.connect()

          const session = mcpClient.getSession()
          if (session) {
            addMCPSession(session)
            addMCPClient(session.sessionId, mcpClient)
            newClients.set(name, mcpClient)

            // Add tools
            session.tools.forEach((tool) => {
              newTools.set(`${name}:${tool.name}`, {
                tool,
                serverName: name,
              })
            })
          }
        } catch (err) {
          console.error(`Failed to connect to ${name}:`, err)
          // Continue with other servers
        }
      }

      setClients(newClients)
      setAllTools(newTools)

      if (newClients.size === 0) {
        throw new Error('Failed to connect to any servers')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async (serverName: string) => {
    const client = clients.get(serverName)
    if (client) {
      await client.disconnect()
      const session = client.getSession()
      if (session) {
        removeMCPSession(session.sessionId)
      }

      // Remove from local state
      const newClients = new Map(clients)
      newClients.delete(serverName)
      setClients(newClients)

      // Remove tools
      const newTools = new Map(allTools)
      for (const [key] of newTools) {
        if (key.startsWith(`${serverName}:`)) {
          newTools.delete(key)
        }
      }
      setAllTools(newTools)

      setSelectedTool('')
      setToolResult(null)
    }
  }

  const handleDisconnectAll = async () => {
    for (const [serverName] of clients) {
      await handleDisconnect(serverName)
    }
  }

  const handleExecuteTool = async () => {
    if (!selectedTool) return

    const toolData = allTools.get(selectedTool)
    if (!toolData) return

    const client = clients.get(toolData.serverName)
    if (!client) return

    setIsExecuting(true)
    setError(null)
    setToolResult(null)

    try {
      let args: Record<string, unknown>
      try {
        args = toolInput.trim() ? JSON.parse(toolInput) : {}
      } catch {
        throw new Error('Invalid JSON input for tool arguments')
      }

      const result = await client.callTool({
        toolName: toolData.tool.name,
        arguments: args,
        timestamp: Date.now(),
      })

      setToolResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsExecuting(false)
    }
  }

  const getToolInputExample = (toolName: string): string => {
    const examples: Record<string, string> = {
      calculator: '{ "expression": "2 + 2" }',
      get_time: '{}',
      reverse_text: '{ "text": "Hello World" }',
      word_count: '{ "text": "The quick brown fox" }',
    }
    return examples[toolName] ?? '{}'
  }

  const loadExampleConfig = () => {
    const example: MCPServersConfig = {
      mcpServers: {
        'demo-server': {
          url: 'http://localhost:3001/mcp',
          description:
            'Local demo server with calculator, time, and text tools',
        },
        // Example of additional servers (commented out)
        // 'github-mcp': {
        //   url: 'https://your-mcp-server.com/mcp',
        //   description: 'GitHub integration MCP server'
        // },
      },
    }
    setJsonConfig(JSON.stringify(example, null, 2))
  }

  return (
    <div className="mcp-manager">
      <div className="mcp-header">
        <h2>🔌 MCP Connection Manager</h2>
        <p>Connect to Model Context Protocol servers and test tools</p>
      </div>

      {/* Mode Tabs */}
      <div className="mode-tabs">
        <button
          className={`mode-tab ${configMode === 'single' ? 'active' : ''}`}
          onClick={() => setConfigMode('single')}
        >
          Quick Connect
        </button>
        <button
          className={`mode-tab ${configMode === 'json' ? 'active' : ''}`}
          onClick={() => setConfigMode('json')}
        >
          JSON Config
        </button>
      </div>

      {/* Single Server Connection */}
      {configMode === 'single' && (
        <div className="connection-panel">
          <h3>Single Server Connection</h3>
          <div className="connection-form">
            <div className="form-group">
              <label htmlFor="server-name">Server Name:</label>
              <input
                id="server-name"
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                disabled={isConnecting}
                placeholder="my-mcp-server"
              />
            </div>

            <div className="form-group">
              <label htmlFor="server-url">Server URL:</label>
              <input
                id="server-url"
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                disabled={isConnecting}
                placeholder="http://localhost:3001/mcp"
              />
            </div>

            <button
              onClick={handleConnectSingle}
              disabled={isConnecting || !serverUrl || !serverName}
              className="btn-primary"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>
      )}

      {/* JSON Bulk Configuration */}
      {configMode === 'json' && (
        <div className="connection-panel">
          <div className="json-header">
            <h3>JSON Configuration</h3>
            <button onClick={loadExampleConfig} className="btn-small">
              Load Example
            </button>
          </div>

          <p className="helper-text">
            Configure multiple MCP servers at once. Format for browser-based
            HTTP servers:
          </p>

          <textarea
            className="json-editor"
            value={jsonConfig}
            onChange={(e) => setJsonConfig(e.target.value)}
            placeholder={JSON.stringify(DEFAULT_CONFIG, null, 2)}
            rows={12}
            disabled={isConnecting}
            spellCheck={false}
          />

          <button
            onClick={handleConnectFromJSON}
            disabled={isConnecting}
            className="btn-primary"
          >
            {isConnecting ? 'Connecting...' : 'Connect All Servers'}
          </button>

          <div className="info-box">
            <strong>Note:</strong> Browser MCP clients use HTTP URLs instead of
            stdio commands. For stdio-based servers (like chrome-devtools-mcp),
            you need to run a proxy server that exposes them via HTTP.
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      )}

      {/* Connected Servers */}
      {clients.size > 0 && (
        <div className="connected-servers">
          <div className="servers-header">
            <h3>Connected Servers ({clients.size})</h3>
            <button onClick={handleDisconnectAll} className="btn-small">
              Disconnect All
            </button>
          </div>

          <div className="servers-list">
            {Array.from(clients.entries()).map(([name, client]) => {
              const session = client.getSession()
              return (
                <div key={name} className="server-item">
                  <div className="server-info">
                    <div className="server-name">{name}</div>
                    <div className="server-url">{session?.serverUrl}</div>
                    <div className="server-meta">
                      {session?.tools.length ?? 0} tools
                    </div>
                  </div>
                  <button
                    onClick={() => handleDisconnect(name)}
                    className="btn-danger-small"
                  >
                    Disconnect
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Available Tools */}
      {allTools.size > 0 && (
        <div className="tools-panel">
          <h3>Available Tools ({allTools.size})</h3>
          <div className="tools-list">
            {Array.from(allTools.entries()).map(([key, { tool, serverName }]) => (
              <div
                key={key}
                className={`tool-card ${selectedTool === key ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedTool(key)
                  setToolInput(getToolInputExample(tool.name))
                  setToolResult(null)
                  setError(null)
                }}
              >
                <div className="tool-name">{tool.name}</div>
                <div className="tool-server">from: {serverName}</div>
                <div className="tool-description">{tool.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tool Execution */}
      {selectedTool && (
        <div className="tool-execution-panel">
          <h3>
            Execute Tool: {allTools.get(selectedTool)?.tool.name}
          </h3>
          <p className="tool-desc">
            {allTools.get(selectedTool)?.tool.description}
          </p>

          <div className="tool-input-group">
            <label htmlFor="tool-input">Tool Arguments (JSON):</label>
            <textarea
              id="tool-input"
              value={toolInput}
              onChange={(e) => setToolInput(e.target.value)}
              placeholder='{ "param": "value" }'
              rows={5}
              disabled={isExecuting}
            />
          </div>

          <button
            onClick={handleExecuteTool}
            disabled={isExecuting}
            className="btn-primary"
          >
            {isExecuting ? 'Executing...' : 'Execute Tool'}
          </button>

          {toolResult && (
            <div
              className={`result-panel ${toolResult.success ? 'success' : 'error'}`}
            >
              <h4>{toolResult.success ? '✅ Success' : '❌ Error'}</h4>
              <div className="result-meta">
                <span>Execution Time: {toolResult.executionTime}ms</span>
              </div>
              <pre className="result-content">
                {JSON.stringify(toolResult.content, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {clients.size === 0 && (
        <div className="info-message">
          <p>ℹ️ No servers connected. Use Quick Connect or JSON Config to connect.</p>
        </div>
      )}
    </div>
  )
}

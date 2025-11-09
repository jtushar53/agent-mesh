/**
 * Simplified Mock MCP Server for AgentMesh Testing
 * NOTE: This is a simplified mock for prototype - use official MCP SDK in production
 */

import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3001

// Enable CORS with MCP headers
app.use(
  cors({
    origin: ['http://localhost:5173'],
    exposedHeaders: ['Mcp-Session-Id'],
    allowedHeaders: ['Content-Type', 'mcp-session-id'],
  })
)

app.use(express.json())

// Simple in-memory session management
const sessions = new Map()

// Initialize endpoint
app.post('/mcp/initialize', (req, res) => {
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  sessions.set(sessionId, {
    id: sessionId,
    created: Date.now(),
  })

  res.setHeader('Mcp-Session-Id', sessionId)
  res.json({
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
    serverInfo: {
      name: 'agentmesh-demo-server',
      version: '0.1.0',
    },
  })
})

// List tools endpoint
app.post('/mcp/tools/list', (req, res) => {
  res.json({
    tools: [
      {
        name: 'calculator',
        description:
          'Performs mathematical calculations. Supports basic arithmetic operations.',
        inputSchema: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Mathematical expression to evaluate (e.g., "2 + 2", "10 * 5")',
            },
          },
          required: ['expression'],
        },
      },
      {
        name: 'get_time',
        description: 'Returns the current server time in ISO format.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'reverse_text',
        description: 'Reverses the given text string.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to reverse',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'word_count',
        description: 'Counts words and characters in the given text.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to analyze',
            },
          },
          required: ['text'],
        },
      },
    ],
  })
})

// Call tool endpoint
app.post('/mcp/tools/call', (req, res) => {
  const { name, arguments: args } = req.body

  try {
    let result

    switch (name) {
      case 'calculator': {
        const expression = args.expression
        try {
          // Simple eval for demo - use a safe math parser in production!
          result = { result: eval(expression) }
        } catch (error) {
          throw new Error(`Invalid expression: ${error.message}`)
        }
        break
      }

      case 'get_time': {
        result = {
          time: new Date().toISOString(),
          timestamp: Date.now(),
        }
        break
      }

      case 'reverse_text': {
        const text = args.text
        result = {
          original: text,
          reversed: text.split('').reverse().join(''),
        }
        break
      }

      case 'word_count': {
        const text = args.text
        const words = text.trim().split(/\s+/).filter(Boolean)
        result = {
          text,
          characters: text.length,
          words: words.length,
          lines: text.split('\n').length,
        }
        break
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }

    res.json({
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    })
  } catch (error) {
    res.status(500).json({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
          }),
        },
      ],
      isError: true,
    })
  }
})

// List resources endpoint
app.post('/mcp/resources/list', (req, res) => {
  res.json({ resources: [] })
})

// List prompts endpoint
app.post('/mcp/prompts/list', (req, res) => {
  res.json({ prompts: [] })
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'agentmesh-demo-server',
    version: '0.1.0',
    sessions: sessions.size,
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MCP Demo Server running on http://localhost:${PORT}`)
  console.log(`📍 MCP endpoint: http://localhost:${PORT}/mcp`)
  console.log(`🏥 Health check: http://localhost:${PORT}/health`)
  console.log('')
  console.log('Available tools:')
  console.log('  - calculator: Perform math calculations')
  console.log('  - get_time: Get current server time')
  console.log('  - reverse_text: Reverse text strings')
  console.log('  - word_count: Count words and characters')
  console.log('')
  console.log('⚠️  NOTE: This is a simplified mock server for prototyping.')
  console.log('   Use the official MCP SDK for production deployments.')
})

/**
 * Agent Execution Viewer
 * Displays real-time agent reasoning with ReAct pattern
 */

import { useState, useEffect } from 'react'
import { ReActAgent } from '@/agents'
import { LLMService, MCPBrowserClient } from '@/services'
import { useAppStore } from '@/store'
import type { AgentStep, MCPTool } from '@/types'
import './AgentViewer.css'

export function AgentViewer() {
  const [task, setTask] = useState('')
  const [agent, setAgent] = useState<ReActAgent | null>(null)
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { llmService, llmStats, mcpClients } = useAppStore()

  // Initialize agent when LLM is loaded
  useEffect(() => {
    if (llmStats?.modelLoaded && llmService && !agent) {
      // Use the stored LLM service instance

      // Check if we have any MCP clients
      const mcpClient = mcpClients.size > 0
        ? Array.from(mcpClients.values())[0]
        : undefined

      // Built-in tools for demo
      const builtInTools: MCPTool[] = [
        {
          name: 'calculator',
          description: 'Performs mathematical calculations. Input: { expression: string }',
          inputSchema: {} as any,
        },
        {
          name: 'text_length',
          description: 'Counts words and characters in text. Input: { text: string }',
          inputSchema: {} as any,
        },
      ]

      const newAgent = new ReActAgent(
        {
          name: 'demo-agent',
          description: 'A demo agent for testing',
          instructions: `You are a helpful AI assistant. You have access to tools to help solve problems.

When you need to use a tool, format your response exactly like this:
Thought: I need to calculate the result
Action: calculator {"expression": "2 + 2"}

When you have the final answer, format it like this:
Thought: I now have all the information needed
Final Answer: The answer is 4`,
          model: llmStats.modelName,
          maxIterations: 5,
          temperature: 0.7,
          tools: builtInTools,
        },
        llmService,
        mcpClient as MCPBrowserClient | undefined
      )

      // Subscribe to agent events
      newAgent.onEvent((event) => {
        if (event.type === 'thinking' || event.type === 'tool_call') {
          const currentSteps = newAgent.getState().steps
          setSteps([...currentSteps])
        }
      })

      setAgent(newAgent)
    }
  }, [llmStats, llmService, mcpClients, agent])

  const handleRunAgent = async () => {
    if (!agent || !task.trim()) return

    setIsExecuting(true)
    setSteps([])
    setResult(null)
    setError(null)

    try {
      const finalResult = await agent.run(task.trim())
      setResult(finalResult)
      setSteps(agent.getState().steps)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsExecuting(false)
    }
  }

  const getStepIcon = (type: AgentStep['type']) => {
    switch (type) {
      case 'thought':
        return '💭'
      case 'action':
        return '⚡'
      case 'observation':
        return '👁️'
      case 'final_answer':
        return '✅'
      default:
        return '📝'
    }
  }

  const getStepLabel = (type: AgentStep['type']) => {
    switch (type) {
      case 'thought':
        return 'Thought'
      case 'action':
        return 'Action'
      case 'observation':
        return 'Observation'
      case 'final_answer':
        return 'Final Answer'
      default:
        return 'Step'
    }
  }

  return (
    <div className="agent-viewer">
      <div className="agent-header">
        <h2>🤝 ReAct Agent Testing</h2>
        <p>Test multi-step reasoning with Thought → Action → Observation pattern</p>
      </div>

      {!llmStats?.modelLoaded ? (
        <div className="warning-box">
          <p>⚠️ Please load a model in the LLM Testing tab first</p>
        </div>
      ) : (
        <>
          <div className="task-input">
            <label htmlFor="task-input">Task for Agent:</label>
            <textarea
              id="task-input"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Enter a task for the agent to solve..."
              rows={3}
              disabled={isExecuting}
            />
            <button
              onClick={handleRunAgent}
              disabled={isExecuting || !task.trim()}
              className="btn-primary"
            >
              {isExecuting ? 'Agent Working...' : 'Run Agent'}
            </button>
          </div>

          <div className="examples-box">
            <p><strong>Example tasks:</strong></p>
            <div className="examples-list">
              <button
                onClick={() => setTask('What is 15 multiplied by 23?')}
                className="example-btn"
                disabled={isExecuting}
              >
                Math calculation
              </button>
              <button
                onClick={() =>
                  setTask(
                    'Count the words in this text: "The quick brown fox jumps over the lazy dog"'
                  )
                }
                className="example-btn"
                disabled={isExecuting}
              >
                Text analysis
              </button>
              <button
                onClick={() =>
                  setTask('Calculate (10 + 5) * 3 and then count the digits in the result')
                }
                className="example-btn"
                disabled={isExecuting}
              >
                Multi-step task
              </button>
            </div>
          </div>

          {steps.length > 0 && (
            <div className="execution-log">
              <h3>Execution Steps:</h3>
              <div className="steps-container">
                {steps.map((step, idx) => (
                  <div key={idx} className={`step step-${step.type}`}>
                    <div className="step-header">
                      <span className="step-icon">{getStepIcon(step.type)}</span>
                      <span className="step-label">
                        {getStepLabel(step.type)} {idx + 1}
                      </span>
                      <span className="step-time">
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="step-content">
                      {step.content}
                      {step.toolName && (
                        <div className="tool-info">
                          <strong>Tool:</strong> {step.toolName}
                          {step.toolInput && (
                            <pre>{JSON.stringify(step.toolInput, null, 2)}</pre>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className="result-box success">
              <h3>✅ Final Result:</h3>
              <p>{result}</p>
            </div>
          )}

          {error && (
            <div className="result-box error">
              <h3>❌ Error:</h3>
              <p>{error}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

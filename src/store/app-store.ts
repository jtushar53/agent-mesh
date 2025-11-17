/**
 * Application Store
 * Central state management using Zustand
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  BrowserCapabilities,
  MCPSession,
  InferenceStats,
  AgentState,
  WorkflowNode,
  WorkflowEdge,
} from '@/types'
import type { LLMService } from '@/services/llm-service'
import type { MCPBrowserClient } from '@/services/mcp-client'

interface AppState {
  // Browser capabilities
  capabilities: BrowserCapabilities | null
  setCapabilities: (capabilities: BrowserCapabilities) => void

  // MCP state
  mcpSessions: Map<string, MCPSession>
  mcpClients: Map<string, MCPBrowserClient>
  addMCPSession: (session: MCPSession) => void
  removeMCPSession: (sessionId: string) => void
  getMCPSession: (sessionId: string) => MCPSession | undefined
  addMCPClient: (sessionId: string, client: MCPBrowserClient) => void
  getMCPClient: (sessionId: string) => MCPBrowserClient | undefined

  // LLM state
  llmService: LLMService | null
  setLLMService: (service: LLMService | null) => void
  llmStats: InferenceStats | null
  setLLMStats: (stats: InferenceStats | null) => void
  modelLoading: boolean
  setModelLoading: (loading: boolean) => void
  modelLoadProgress: { text: string; progress: number } | null
  setModelLoadProgress: (progress: {
    text: string
    progress: number
  } | null) => void

  // Agent state
  currentAgent: AgentState | null
  setCurrentAgent: (agent: AgentState | null) => void
  agentExecuting: boolean
  setAgentExecuting: (executing: boolean) => void

  // Workflow state
  workflowNodes: WorkflowNode[]
  workflowEdges: WorkflowEdge[]
  setWorkflowNodes: (nodes: WorkflowNode[]) => void
  setWorkflowEdges: (edges: WorkflowEdge[]) => void
  addWorkflowNode: (node: WorkflowNode) => void
  removeWorkflowNode: (nodeId: string) => void
  updateWorkflowNode: (nodeId: string, data: Partial<WorkflowNode>) => void

  // UI state
  sidebarOpen: boolean
  toggleSidebar: () => void
  activeView: 'agent' | 'workflow' | 'settings'
  setActiveView: (view: 'agent' | 'workflow' | 'settings') => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Browser capabilities
      capabilities: null,
      setCapabilities: (capabilities) => set({ capabilities }),

      // MCP state
      mcpSessions: new Map(),
      mcpClients: new Map(),
      addMCPSession: (session) =>
        set((state) => {
          const newSessions = new Map(state.mcpSessions)
          newSessions.set(session.sessionId, session)
          return { mcpSessions: newSessions }
        }),
      removeMCPSession: (sessionId) =>
        set((state) => {
          const newSessions = new Map(state.mcpSessions)
          const newClients = new Map(state.mcpClients)
          newSessions.delete(sessionId)
          newClients.delete(sessionId)
          return { mcpSessions: newSessions, mcpClients: newClients }
        }),
      getMCPSession: (sessionId) => get().mcpSessions.get(sessionId),
      addMCPClient: (sessionId, client) =>
        set((state) => {
          const newClients = new Map(state.mcpClients)
          newClients.set(sessionId, client)
          return { mcpClients: newClients }
        }),
      getMCPClient: (sessionId) => get().mcpClients.get(sessionId),

      // LLM state
      llmService: null,
      setLLMService: (service) => set({ llmService: service }),
      llmStats: null,
      setLLMStats: (stats) => set({ llmStats: stats }),
      modelLoading: false,
      setModelLoading: (loading) => set({ modelLoading: loading }),
      modelLoadProgress: null,
      setModelLoadProgress: (progress) =>
        set({ modelLoadProgress: progress }),

      // Agent state
      currentAgent: null,
      setCurrentAgent: (agent) => set({ currentAgent: agent }),
      agentExecuting: false,
      setAgentExecuting: (executing) => set({ agentExecuting: executing }),

      // Workflow state
      workflowNodes: [],
      workflowEdges: [],
      setWorkflowNodes: (nodes) => set({ workflowNodes: nodes }),
      setWorkflowEdges: (edges) => set({ workflowEdges: edges }),
      addWorkflowNode: (node) =>
        set((state) => ({
          workflowNodes: [...state.workflowNodes, node],
        })),
      removeWorkflowNode: (nodeId) =>
        set((state) => ({
          workflowNodes: state.workflowNodes.filter(
            (node) => node.id !== nodeId
          ),
          workflowEdges: state.workflowEdges.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId
          ),
        })),
      updateWorkflowNode: (nodeId, data) =>
        set((state) => ({
          workflowNodes: state.workflowNodes.map((node) =>
            node.id === nodeId ? { ...node, ...data } : node
          ),
        })),

      // UI state
      sidebarOpen: true,
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      activeView: 'agent',
      setActiveView: (view) => set({ activeView: view }),
    }),
    {
      name: 'agentmesh-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist UI preferences, not runtime state
        sidebarOpen: state.sidebarOpen,
        activeView: state.activeView,
      }),
    }
  )
)

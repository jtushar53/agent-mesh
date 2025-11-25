/**
 * Agent Mesh - The Satellite Orchestration System
 * Coordinates all 6 satellites to work together as a cohesive AI system
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  SatelliteId,
  SatelliteTask,
  SatelliteResult,
  ExecutionPlan,
  AgentMeshState,
  DenDenMushiState,
} from '@/types/satellites'
import type { ChatMessage } from '@/types/llm'
import { Shaka, Lilith, Edison, Pythagoras, Atlas, York } from '@/satellites'
import type { SatelliteEvent } from '@/satellites'
import type { LLMService } from './llm-service'
import { PunkRecords } from './punk-records'
import { logger } from '@/utils'

export type MeshEventType =
  | 'plan_created'
  | 'task_started'
  | 'task_completed'
  | 'all_complete'
  | 'error'
  | 'message'

export interface MeshEvent {
  type: MeshEventType
  data: unknown
  timestamp: number
}

export type MeshEventCallback = (event: MeshEvent) => void

/**
 * Agent Mesh - Coordinates all satellite agents
 */
export class AgentMesh {
  private shaka: Shaka
  private lilith: Lilith
  private edison: Edison
  private pythagoras: Pythagoras
  private atlas: Atlas
  private york: York

  private punkRecords: PunkRecords
  private llmService: LLMService

  private state: AgentMeshState
  private eventCallbacks: MeshEventCallback[] = []
  private isProcessing = false

  constructor(llmService: LLMService) {
    this.llmService = llmService
    this.punkRecords = new PunkRecords()

    // Initialize all satellites
    this.shaka = new Shaka(llmService, this.punkRecords)
    this.lilith = new Lilith(llmService, this.punkRecords)
    this.edison = new Edison(llmService, this.punkRecords)
    this.pythagoras = new Pythagoras(llmService, this.punkRecords)
    this.atlas = new Atlas(llmService, this.punkRecords)
    this.york = new York(llmService, this.punkRecords)

    // Initialize state
    this.state = {
      satellites: new Map([
        ['shaka', this.shaka.getState()],
        ['lilith', this.lilith.getState()],
        ['edison', this.edison.getState()],
        ['pythagoras', this.pythagoras.getState()],
        ['atlas', this.atlas.getState()],
        ['york', this.york.getState()],
      ]),
      messageQueue: [],
      resources: this.york.getResourceMetrics(),
      lastUpdate: Date.now(),
    }

    // Set up satellite event handlers
    this.setupSatelliteEventHandlers()

    logger.info('Agent Mesh initialized with all 6 satellites')
  }

  /**
   * Initialize the mesh (load data, prepare indices)
   */
  async initialize(): Promise<void> {
    await this.punkRecords.initialize()
    logger.info('Agent Mesh fully initialized')
  }

  /**
   * Process a user request through the mesh
   */
  async processRequest(userInput: string): Promise<string> {
    if (this.isProcessing) {
      throw new Error('Already processing a request')
    }

    this.isProcessing = true
    const requestId = uuidv4()

    logger.info('Agent Mesh processing request', { requestId, input: userInput })

    try {
      // Track conversation
      this.york.addConversationTurn({
        role: 'user',
        content: userInput,
        timestamp: Date.now(),
        tokenCount: Math.ceil(userInput.length / 4),
      })

      // Step 1: SHAKA creates execution plan
      const planTask: SatelliteTask = {
        id: uuidv4(),
        satelliteId: 'shaka',
        description: 'Create execution plan',
        input: userInput,
        dependencies: [],
        priority: 100,
        createdAt: Date.now(),
        status: 'pending',
      }

      const planResult = await this.shaka.execute(planTask)

      if (!planResult.success) {
        throw new Error(`Planning failed: ${planResult.error}`)
      }

      const plan: ExecutionPlan = JSON.parse(planResult.output)
      this.state.activePlan = plan
      this.emitEvent('plan_created', { plan })

      logger.info('Execution plan created', {
        taskCount: plan.tasks.length,
      })

      // Step 2: Execute tasks according to DAG
      const results = await this.executePlan(plan)

      // Step 3: LILITH reviews the final output
      const finalOutput = results.map(r => r.output).join('\n\n')
      const critique = await this.lilith.critique(finalOutput, 'output', requestId)

      // Step 4: SHAKA synthesizes final response
      let response = await this.shaka.synthesizeResults(plan.dag, userInput)

      // If critique found major issues, append warning
      if (!critique.approved) {
        response += `\n\n⚠️ Quality Note: Some issues were detected (score: ${critique.score}/100)`
      }

      // Track assistant response
      this.york.addConversationTurn({
        role: 'assistant',
        content: response,
        satelliteId: 'shaka',
        timestamp: Date.now(),
        tokenCount: Math.ceil(response.length / 4),
      })

      this.emitEvent('all_complete', { response, results })

      return response
    } catch (error) {
      logger.error('Agent Mesh request failed', { error })
      this.emitEvent('error', { error })
      throw error
    } finally {
      this.isProcessing = false
      this.state.activePlan = undefined
    }
  }

  /**
   * Execute a plan by running tasks according to DAG
   */
  private async executePlan(plan: ExecutionPlan): Promise<SatelliteResult[]> {
    const results: SatelliteResult[] = []
    const { dag } = plan

    while (!this.shaka.isDAGComplete(dag)) {
      // Get tasks ready for execution
      const readyNodes = this.shaka.getReadyTasks(dag)

      if (readyNodes.length === 0) {
        logger.warn('No ready nodes but DAG not complete - possible cycle')
        break
      }

      // Execute ready tasks in parallel
      const executions = readyNodes.map(async (nodeId) => {
        const node = dag.nodes.get(nodeId)!
        const task = plan.tasks.find(t => t.id === node.taskId || t.description === nodeId)

        if (!task) {
          logger.warn('Task not found for node', { nodeId })
          return null
        }

        this.emitEvent('task_started', { nodeId, task })
        node.status = 'running'

        const satellite = this.getSatellite(task.satelliteId)
        const result = await satellite.execute(task)

        this.shaka.markTaskComplete(dag, nodeId, result)
        this.emitEvent('task_completed', { nodeId, result })

        return result
      })

      const batchResults = await Promise.all(executions)
      results.push(...batchResults.filter((r): r is SatelliteResult => r !== null))
    }

    return results
  }

  /**
   * Get satellite instance by ID
   */
  private getSatellite(id: SatelliteId) {
    switch (id) {
      case 'shaka':
        return this.shaka
      case 'lilith':
        return this.lilith
      case 'edison':
        return this.edison
      case 'pythagoras':
        return this.pythagoras
      case 'atlas':
        return this.atlas
      case 'york':
        return this.york
      default:
        throw new Error(`Unknown satellite: ${id}`)
    }
  }

  /**
   * Set up event handlers for satellite events
   */
  private setupSatelliteEventHandlers(): void {
    const satellites = [
      this.shaka,
      this.lilith,
      this.edison,
      this.pythagoras,
      this.atlas,
      this.york,
    ]

    for (const satellite of satellites) {
      satellite.onEvent((event: SatelliteEvent) => {
        // Update state
        this.state.satellites.set(event.satelliteId, satellite.getState())
        this.state.lastUpdate = Date.now()

        // Forward as mesh event
        this.emitEvent('message', {
          satellite: event.satelliteId,
          type: event.type,
          data: event.data,
        })
      })
    }
  }

  /**
   * Send a direct message to a satellite
   */
  async sendToSatellite(
    satelliteId: SatelliteId,
    input: string
  ): Promise<SatelliteResult> {
    const satellite = this.getSatellite(satelliteId)

    const task: SatelliteTask = {
      id: uuidv4(),
      satelliteId,
      description: input,
      input,
      dependencies: [],
      priority: 50,
      createdAt: Date.now(),
      status: 'pending',
    }

    return satellite.execute(task)
  }

  /**
   * Add document to Punk Records
   */
  async addDocument(content: string, metadata: Record<string, unknown>): Promise<void> {
    await this.punkRecords.addDocument(content, {
      source: 'user',
      type: 'text',
      ...metadata,
    })
  }

  /**
   * Search Punk Records
   */
  async search(query: string, limit = 10) {
    return this.punkRecords.search(query, { limit })
  }

  /**
   * Get Den Den Mushi (MCP) state
   */
  getDenDenMushiState(): DenDenMushiState {
    return this.atlas.getConnectionState()
  }

  /**
   * Get resource metrics
   */
  getResourceMetrics() {
    return this.york.getResourceMetrics()
  }

  /**
   * Get context summary
   */
  getContextSummary() {
    return this.york.getContextSummary()
  }

  /**
   * Trigger Brain-Brain Cut manually
   */
  async triggerBrainBrainCut(): Promise<string> {
    return this.york.performContextEviction()
  }

  /**
   * Get current mesh state
   */
  getState(): AgentMeshState {
    // Update satellite states
    this.state.satellites.set('shaka', this.shaka.getState())
    this.state.satellites.set('lilith', this.lilith.getState())
    this.state.satellites.set('edison', this.edison.getState())
    this.state.satellites.set('pythagoras', this.pythagoras.getState())
    this.state.satellites.set('atlas', this.atlas.getState())
    this.state.satellites.set('york', this.york.getState())
    this.state.resources = this.york.getResourceMetrics()

    return { ...this.state }
  }

  /**
   * Subscribe to mesh events
   */
  onEvent(callback: MeshEventCallback): () => void {
    this.eventCallbacks.push(callback)
    return () => {
      const index = this.eventCallbacks.indexOf(callback)
      if (index > -1) {
        this.eventCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Emit a mesh event
   */
  private emitEvent(type: MeshEventType, data: unknown): void {
    const event: MeshEvent = {
      type,
      data,
      timestamp: Date.now(),
    }
    this.eventCallbacks.forEach(cb => cb(event))
  }

  /**
   * Get conversation history for display
   */
  getConversationContext(): ChatMessage[] {
    return this.york.getContextForLLM()
  }

  /**
   * Clear all context
   */
  clearContext(): void {
    this.york.clearContext()
  }

  /**
   * Get Punk Records stats
   */
  async getDataStats() {
    return this.punkRecords.getStats()
  }

  /**
   * Check if mesh is ready
   */
  isReady(): boolean {
    return this.llmService.isLoaded()
  }

  /**
   * Check if currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing
  }
}

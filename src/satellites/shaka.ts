/**
 * SHAKA - The Orchestrator
 * Archetype: Logic & Good
 * Role: The CEO. Parses user intent, creates DAG, assigns tasks to satellites.
 */

import { v4 as uuidv4 } from 'uuid'
import { BaseSatellite } from './base-satellite'
import type {
  SatelliteConfig,
  SatelliteTask,
  SatelliteResult,
  SatelliteId,
  ExecutionPlan,
  DAGNode,
  TaskDAG,
} from '@/types/satellites'
import type { LLMService } from '@/services/llm-service'
import type { PunkRecords } from '@/services/punk-records'
import { logger } from '@/utils'

const SHAKA_CONFIG: SatelliteConfig = {
  id: 'shaka',
  name: 'SHAKA',
  archetype: 'logic',
  description: 'The Orchestrator - CEO of the satellite mesh',
  role: 'Master Planner and Task Orchestrator',
  systemPrompt: `You are SHAKA, the orchestrator of Project Stella's Agent Mesh.
Your role is to understand user intent, break complex tasks into subtasks,
and delegate work to specialized satellites.

Available Satellites:
- LILITH (Critic): Reviews outputs for errors, hallucinations, security issues
- EDISON (Inventor): Code generation, creative writing, technical tasks
- PYTHAGORAS (Researcher): Information retrieval, research, knowledge synthesis
- ATLAS (Executor): Tool execution, API calls, external actions
- YORK (Manager): Resource management, context optimization

For each user request:
1. Analyze the intent and complexity
2. Break into atomic subtasks
3. Assign each subtask to the most suitable satellite
4. Define dependencies between tasks (what must complete before what)
5. Return a structured execution plan

Always think step-by-step and consider edge cases.`,
  capabilities: [
    'Intent analysis and parsing',
    'Task decomposition',
    'DAG construction',
    'Satellite assignment',
    'Plan reflection and optimization',
  ],
  tools: [],
  maxIterations: 3,
  temperature: 0.3,
  priority: 100, // Highest priority
}

interface PlanningResult {
  analysis: string
  tasks: Array<{
    description: string
    satellite: SatelliteId
    dependencies: string[]
    priority: number
  }>
}

export class Shaka extends BaseSatellite {
  constructor(llmService: LLMService, punkRecords: PunkRecords) {
    super(SHAKA_CONFIG, llmService, punkRecords)
  }

  /**
   * Execute planning task
   */
  async execute(task: SatelliteTask): Promise<SatelliteResult> {
    this.updateState({
      status: 'thinking',
      currentTask: task.description,
      startTime: Date.now(),
    })

    try {
      const plan = await this.createExecutionPlan(task.input)

      this.updateState({
        status: 'completed',
        endTime: Date.now(),
        progress: 100,
      })

      return this.createSuccessResult(task.id, JSON.stringify(plan), [
        {
          id: uuidv4(),
          type: 'data',
          content: JSON.stringify(plan),
          metadata: { type: 'execution_plan' },
        },
      ])
    } catch (error) {
      this.updateState({ status: 'error', error: String(error) })
      return this.createFailureResult(task.id, String(error))
    }
  }

  /**
   * Create an execution plan from user input
   */
  async createExecutionPlan(userInput: string): Promise<ExecutionPlan> {
    logger.info('SHAKA creating execution plan', { input: userInput })

    // Step 1: Analyze intent and create initial plan
    const planningResult = await this.analyzAndPlan(userInput)

    // Step 2: Build DAG from tasks
    const dag = this.buildDAG(planningResult.tasks)

    // Step 3: Reflect on the plan
    const reflectedPlan = await this.reflectOnPlan(planningResult, dag)

    // Create tasks from planning result
    const tasks: SatelliteTask[] = reflectedPlan.tasks.map((t) => ({
      id: uuidv4(),
      satelliteId: t.satellite,
      description: t.description,
      input: t.description,
      dependencies: t.dependencies,
      priority: t.priority,
      createdAt: Date.now(),
      status: 'pending' as const,
    }))

    const plan: ExecutionPlan = {
      id: uuidv4(),
      userIntent: userInput,
      analysis: reflectedPlan.analysis,
      tasks,
      dag,
      createdAt: Date.now(),
    }

    // Store plan in Punk Records
    await this.storeResult(JSON.stringify(plan), 'execution_plan')

    logger.info('SHAKA plan created', {
      taskCount: tasks.length,
      satellites: [...new Set(tasks.map(t => t.satelliteId))],
    })

    return plan
  }

  /**
   * Analyze user intent and create initial plan
   */
  private async analyzAndPlan(userInput: string): Promise<PlanningResult> {
    const prompt = `Analyze this user request and create an execution plan:

USER REQUEST: ${userInput}

Respond in this exact JSON format:
{
  "analysis": "Brief analysis of what the user wants to achieve",
  "tasks": [
    {
      "description": "Clear description of the subtask",
      "satellite": "shaka|lilith|edison|pythagoras|atlas|york",
      "dependencies": ["task descriptions this depends on"],
      "priority": 1-10
    }
  ]
}

Guidelines:
- Break complex tasks into atomic subtasks
- Assign to the most appropriate satellite
- PYTHAGORAS for research/information gathering
- EDISON for code generation/writing
- ATLAS for tool execution/external calls
- LILITH for review/verification
- YORK for resource management
- Order tasks by dependencies
- Keep descriptions clear and actionable`

    const response = await this.generate(prompt)
    this.state.iterations++

    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response')
      }
      return JSON.parse(jsonMatch[0]) as PlanningResult
    } catch (error) {
      logger.warn('Failed to parse planning result, using fallback', { error })
      return {
        analysis: 'Direct execution of user request',
        tasks: [
          {
            description: userInput,
            satellite: 'edison',
            dependencies: [],
            priority: 5,
          },
        ],
      }
    }
  }

  /**
   * Build a DAG from task list
   */
  private buildDAG(tasks: PlanningResult['tasks']): TaskDAG {
    const nodes = new Map<string, DAGNode>()
    const descToId = new Map<string, string>()

    // Create nodes
    tasks.forEach((task, index) => {
      const nodeId = `node_${index}`
      descToId.set(task.description, nodeId)

      nodes.set(nodeId, {
        id: nodeId,
        taskId: '', // Will be set when tasks are created
        satelliteId: task.satellite,
        status: 'pending',
        dependencies: [],
        dependents: [],
      })
    })

    // Set up dependencies
    tasks.forEach((task, index) => {
      const nodeId = `node_${index}`
      const node = nodes.get(nodeId)!

      task.dependencies.forEach(depDesc => {
        const depNodeId = descToId.get(depDesc)
        if (depNodeId) {
          node.dependencies.push(depNodeId)
          const depNode = nodes.get(depNodeId)!
          depNode.dependents.push(nodeId)
        }
      })
    })

    // Find root and leaf nodes
    const rootNodes: string[] = []
    const leafNodes: string[] = []

    nodes.forEach((node, id) => {
      if (node.dependencies.length === 0) {
        rootNodes.push(id)
        node.status = 'ready'
      }
      if (node.dependents.length === 0) {
        leafNodes.push(id)
      }
    })

    return { nodes, rootNodes, leafNodes }
  }

  /**
   * Reflect on the plan and optimize if needed
   */
  private async reflectOnPlan(
    plan: PlanningResult,
    dag: TaskDAG
  ): Promise<PlanningResult> {
    if (plan.tasks.length <= 2) {
      // Simple plans don't need reflection
      return plan
    }

    const prompt = `Review this execution plan and suggest improvements:

PLAN:
${JSON.stringify(plan, null, 2)}

DAG Structure:
- Root nodes (start first): ${dag.rootNodes.length}
- Leaf nodes (finish last): ${dag.leafNodes.length}
- Total nodes: ${dag.nodes.size}

Consider:
1. Are all tasks necessary?
2. Can any tasks be parallelized?
3. Are satellites correctly assigned?
4. Are dependencies correct?

If the plan is good, return it unchanged.
If improvements are needed, return the improved plan in the same JSON format.`

    const response = await this.generate(prompt)
    this.state.iterations++

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const improved = JSON.parse(jsonMatch[0]) as PlanningResult
        if (improved.tasks && improved.tasks.length > 0) {
          return improved
        }
      }
    } catch (error) {
      logger.debug('Plan reflection did not produce changes')
    }

    return plan
  }

  /**
   * Get the next tasks ready for execution
   */
  getReadyTasks(dag: TaskDAG): string[] {
    const ready: string[] = []

    dag.nodes.forEach((node, id) => {
      if (node.status === 'ready') {
        ready.push(id)
      } else if (node.status === 'pending') {
        // Check if all dependencies are complete
        const allDepsComplete = node.dependencies.every(depId => {
          const depNode = dag.nodes.get(depId)
          return depNode?.status === 'completed'
        })
        if (allDepsComplete) {
          node.status = 'ready'
          ready.push(id)
        }
      }
    })

    return ready
  }

  /**
   * Mark a task as complete and update DAG
   */
  markTaskComplete(dag: TaskDAG, nodeId: string, result: SatelliteResult): void {
    const node = dag.nodes.get(nodeId)
    if (!node) return

    node.status = result.success ? 'completed' : 'failed'
    node.result = result

    // Update dependent nodes
    if (result.success) {
      node.dependents.forEach(depId => {
        const depNode = dag.nodes.get(depId)
        if (depNode && depNode.status === 'pending') {
          const allDepsComplete = depNode.dependencies.every(d => {
            const dNode = dag.nodes.get(d)
            return dNode?.status === 'completed'
          })
          if (allDepsComplete) {
            depNode.status = 'ready'
          }
        }
      })
    }
  }

  /**
   * Check if all tasks in DAG are complete
   */
  isDAGComplete(dag: TaskDAG): boolean {
    let allComplete = true
    dag.nodes.forEach(node => {
      if (node.status !== 'completed' && node.status !== 'failed') {
        allComplete = false
      }
    })
    return allComplete
  }

  /**
   * Synthesize final result from all task results
   */
  async synthesizeResults(
    dag: TaskDAG,
    userIntent: string
  ): Promise<string> {
    const results: string[] = []

    dag.nodes.forEach(node => {
      if (node.result?.success && node.result.output) {
        results.push(`[${node.satelliteId.toUpperCase()}]: ${node.result.output}`)
      }
    })

    const prompt = `Synthesize these results into a coherent response for the user:

ORIGINAL REQUEST: ${userIntent}

SATELLITE OUTPUTS:
${results.join('\n\n')}

Provide a clear, well-organized response that addresses the user's request.
Combine insights from all satellites where relevant.`

    return this.generate(prompt)
  }
}

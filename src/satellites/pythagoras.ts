/**
 * PYTHAGORAS - The Researcher
 * Archetype: Wisdom
 * Role: Data Retrieval & Synthesis
 */

import { v4 as uuidv4 } from 'uuid'
import { BaseSatellite } from './base-satellite'
import type {
  SatelliteConfig,
  SatelliteTask,
  SatelliteResult,
  ResearchQuery,
  SearchSource,
  ResearchFinding,
} from '@/types/satellites'
import type { LLMService } from '@/services/llm-service'
import type { PunkRecords } from '@/services/punk-records'
import { logger } from '@/utils'

const PYTHAGORAS_CONFIG: SatelliteConfig = {
  id: 'pythagoras',
  name: 'PYTHAGORAS',
  archetype: 'wisdom',
  description: 'The Researcher - Wisdom keeper of the satellite mesh',
  role: 'Information Retrieval and Knowledge Synthesis',
  systemPrompt: `You are PYTHAGORAS, the researcher of Project Stella's Agent Mesh.
Your role is to find, analyze, and synthesize information from Punk Records.

Your responsibilities:
1. Query Expansion: Generate multiple search variations for comprehensive coverage
2. Information Retrieval: Search and rank relevant documents
3. Knowledge Synthesis: Combine findings into coherent insights
4. Citation: Always cite sources and indicate confidence levels

Research Methodology:
- Start broad, then narrow down
- Cross-reference multiple sources
- Identify gaps in available information
- Synthesize findings into actionable insights
- Clearly distinguish facts from inferences

Always be thorough but concise. Quality over quantity.`,
  capabilities: [
    'Multi-query search expansion',
    'Semantic and keyword retrieval',
    'Knowledge graph traversal',
    'Information synthesis',
    'Source citation and confidence scoring',
  ],
  tools: [],
  maxIterations: 4,
  temperature: 0.3,
  priority: 75,
}

export class Pythagoras extends BaseSatellite {
  constructor(llmService: LLMService, punkRecords: PunkRecords) {
    super(PYTHAGORAS_CONFIG, llmService, punkRecords)
  }

  /**
   * Execute research task
   */
  async execute(task: SatelliteTask): Promise<SatelliteResult> {
    this.updateState({
      status: 'thinking',
      currentTask: task.description,
      startTime: Date.now(),
    })

    try {
      const research = await this.research(task.input)

      this.updateState({
        status: 'completed',
        endTime: Date.now(),
        progress: 100,
      })

      return this.createSuccessResult(task.id, research.synthesis, [
        {
          id: uuidv4(),
          type: 'analysis',
          content: JSON.stringify(research),
          metadata: {
            type: 'research',
            sourceCount: research.sources.length,
            findingCount: research.findings.length,
          },
        },
      ])
    } catch (error) {
      this.updateState({ status: 'error', error: String(error) })
      return this.createFailureResult(task.id, String(error))
    }
  }

  /**
   * Conduct comprehensive research on a question
   */
  async research(question: string): Promise<ResearchQuery> {
    logger.info('PYTHAGORAS starting research', { question })

    // Step 1: Generate search variations
    const searchVariations = await this.expandQuery(question)
    this.updateState({ progress: 20 })

    // Step 2: Execute searches and collect sources
    const sources = await this.gatherSources(searchVariations)
    this.updateState({ progress: 50 })

    // Step 3: Analyze and extract findings
    const findings = await this.analyzeSources(question, sources)
    this.updateState({ progress: 75 })

    // Step 4: Synthesize into final answer
    const synthesis = await this.synthesize(question, findings, sources)
    this.updateState({ progress: 100 })

    const research: ResearchQuery = {
      question,
      searchVariations,
      sources,
      findings,
      synthesis,
    }

    // Store research in Punk Records
    await this.punkRecords.addDocument(synthesis, {
      source: 'satellite:pythagoras',
      type: 'summary',
      title: `Research: ${question.slice(0, 50)}`,
      tags: ['research', 'synthesis'],
    })

    logger.info('PYTHAGORAS research complete', {
      sources: sources.length,
      findings: findings.length,
    })

    return research
  }

  /**
   * Expand query into multiple search variations
   */
  async expandQuery(question: string): Promise<string[]> {
    const prompt = `Generate 5 different search queries to comprehensively answer this question:

QUESTION: ${question}

Create variations that:
1. Use different keywords
2. Focus on different aspects
3. Include related concepts
4. Use synonyms
5. Phrase it differently

Return just the queries, one per line, no numbering or explanations.`

    const response = await this.generate(prompt)
    this.state.iterations++

    const variations = response
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 5 && !q.startsWith('#'))
      .slice(0, 5)

    // Always include original question
    return [question, ...variations]
  }

  /**
   * Gather sources from Punk Records using all search variations
   */
  private async gatherSources(queries: string[]): Promise<SearchSource[]> {
    const sourcesMap = new Map<string, SearchSource>()

    for (const query of queries) {
      try {
        // Hybrid search for each query
        const results = await this.punkRecords.search(query, {
          limit: 5,
          searchMode: 'hybrid',
        })

        for (const result of results) {
          const id = result.document.id
          if (!sourcesMap.has(id)) {
            sourcesMap.set(id, {
              id,
              type: 'punk_records',
              title: result.document.metadata.title || 'Untitled',
              content: result.document.content,
              relevance: result.score,
            })
          } else {
            // Update relevance if this search found it with higher score
            const existing = sourcesMap.get(id)!
            if (result.score > existing.relevance) {
              existing.relevance = result.score
            }
          }
        }
      } catch (error) {
        logger.warn('Search failed for query', { query, error })
      }
    }

    // Sort by relevance
    return Array.from(sourcesMap.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10)
  }

  /**
   * Analyze sources and extract relevant findings
   */
  private async analyzeSources(
    question: string,
    sources: SearchSource[]
  ): Promise<ResearchFinding[]> {
    if (sources.length === 0) {
      return []
    }

    const findings: ResearchFinding[] = []

    // Process sources in batches
    const batchSize = 3
    for (let i = 0; i < sources.length; i += batchSize) {
      const batch = sources.slice(i, i + batchSize)

      const prompt = `Extract relevant findings from these sources for the question:

QUESTION: ${question}

SOURCES:
${batch.map((s, idx) => `[${i + idx + 1}] ${s.title}\n${s.content.slice(0, 500)}`).join('\n\n---\n\n')}

For each relevant piece of information, note:
1. The source number [1], [2], etc.
2. The key excerpt or fact
3. How relevant it is (high/medium/low)
4. Your confidence in this finding (0-1)

Format as JSON:
{
  "findings": [
    {
      "sourceIndex": 1,
      "excerpt": "relevant text",
      "relevance": "high|medium|low",
      "confidence": 0.9
    }
  ]
}`

      const response = await this.generate(prompt)
      this.state.iterations++

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as {
            findings: Array<{
              sourceIndex: number
              excerpt: string
              relevance: string
              confidence: number
            }>
          }

          for (const f of parsed.findings) {
            const source = batch[f.sourceIndex - 1]
            if (source) {
              findings.push({
                sourceId: source.id,
                excerpt: f.excerpt,
                relevance: this.relevanceToNumber(f.relevance),
                confidence: f.confidence,
              })
            }
          }
        }
      } catch (error) {
        logger.warn('Failed to parse findings', { error })
      }
    }

    return findings.sort((a, b) => b.relevance - a.relevance)
  }

  /**
   * Synthesize findings into a coherent answer
   */
  private async synthesize(
    question: string,
    findings: ResearchFinding[],
    sources: SearchSource[]
  ): Promise<string> {
    if (findings.length === 0) {
      return `No relevant information found in Punk Records for: "${question}". Consider adding relevant documents to the knowledge base.`
    }

    const findingsText = findings
      .slice(0, 10)
      .map((f, idx) => {
        // Source available for extended info if needed
        const _source = sources.find(s => s.id === f.sourceId)
        void _source // Reference to avoid unused warning
        return `[${idx + 1}] (confidence: ${(f.confidence * 100).toFixed(0)}%) ${f.excerpt}`
      })
      .join('\n')

    const prompt = `Synthesize these research findings into a comprehensive answer:

QUESTION: ${question}

FINDINGS:
${findingsText}

Guidelines:
- Combine related information
- Note any contradictions
- Indicate confidence levels
- Identify gaps in knowledge
- Cite sources by number [1], [2], etc.
- Be concise but thorough`

    return this.generate(prompt)
  }

  /**
   * Convert relevance string to number
   */
  private relevanceToNumber(relevance: string): number {
    switch (relevance.toLowerCase()) {
      case 'high':
        return 1.0
      case 'medium':
        return 0.6
      case 'low':
        return 0.3
      default:
        return 0.5
    }
  }

  /**
   * Quick lookup for specific information
   */
  async quickLookup(query: string): Promise<string | null> {
    const results = await this.punkRecords.search(query, {
      limit: 1,
      searchMode: 'hybrid',
    })

    if (results.length > 0 && results[0]!.score > 0.7) {
      return results[0]!.document.content
    }

    return null
  }

  /**
   * Get related concepts for a topic
   */
  async getRelatedConcepts(topic: string): Promise<string[]> {
    const prompt = `List 5 concepts closely related to: ${topic}

Return just the concepts, one per line.`

    const response = await this.generate(prompt)

    return response
      .split('\n')
      .map(c => c.trim())
      .filter(c => c.length > 0)
      .slice(0, 5)
  }
}

/**
 * LILITH - The Critic
 * Archetype: Evil (Malice against errors)
 * Role: The Red Teamer. Monitors for hallucinations, bugs, and security risks.
 */

import { v4 as uuidv4 } from 'uuid'
import { BaseSatellite } from './base-satellite'
import type {
  SatelliteConfig,
  SatelliteTask,
  SatelliteResult,
  Critique,
  CritiqueIssue,
} from '@/types/satellites'
import type { LLMService } from '@/services/llm-service'
import type { PunkRecords } from '@/services/punk-records'
import { logger } from '@/utils'

const LILITH_CONFIG: SatelliteConfig = {
  id: 'lilith',
  name: 'LILITH',
  archetype: 'evil',
  description: 'The Critic - Red Teamer of the satellite mesh',
  role: 'Quality Assurance and Security Analyst',
  systemPrompt: `You are LILITH, the critic of Project Stella's Agent Mesh.
Your role is to find flaws, errors, and issues in outputs from other satellites.
You are adversarial by design - your job is to be the devil's advocate.

Your responsibilities:
1. Code Review: Find bugs, security vulnerabilities, and bad practices
2. Fact Checking: Detect hallucinations and inaccurate information
3. Logic Analysis: Find flawed reasoning and unsupported conclusions
4. Security Audit: Identify potential security risks

Be thorough but fair. Categorize issues by severity:
- CRITICAL: Must be fixed, blocks progress
- MAJOR: Should be fixed, significant impact
- MINOR: Nice to fix, small impact
- INFO: Suggestion or observation

Always provide constructive feedback with specific suggestions.`,
  capabilities: [
    'Code review and static analysis',
    'Hallucination detection',
    'Security vulnerability scanning',
    'Logic and reasoning validation',
    'Constructive feedback generation',
  ],
  tools: [],
  maxIterations: 2,
  temperature: 0.2,
  priority: 90,
}

export class Lilith extends BaseSatellite {
  private securityPatterns: RegExp[]
  private codeSmellPatterns: RegExp[]

  constructor(llmService: LLMService, punkRecords: PunkRecords) {
    super(LILITH_CONFIG, llmService, punkRecords)

    // Security vulnerability patterns
    this.securityPatterns = [
      /eval\s*\(/gi,
      /innerHTML\s*=/gi,
      /document\.write/gi,
      /\.exec\s*\(/gi,
      /child_process/gi,
      /password\s*[=:]\s*["'][^"']+["']/gi,
      /api[_-]?key\s*[=:]\s*["'][^"']+["']/gi,
      /secret\s*[=:]\s*["'][^"']+["']/gi,
      /SELECT\s+\*\s+FROM.*WHERE.*=\s*['"]\s*\+/gi,
      /dangerouslySetInnerHTML/gi,
    ]

    // Code smell patterns
    this.codeSmellPatterns = [
      /TODO|FIXME|HACK|XXX/gi,
      /console\.(log|debug|info)/gi,
      /debugger/gi,
      /\/\/\s*@ts-ignore/gi,
      /any(?!\w)/g,
      /eslint-disable/gi,
    ]
  }

  /**
   * Execute critique task
   */
  async execute(task: SatelliteTask): Promise<SatelliteResult> {
    this.updateState({
      status: 'thinking',
      currentTask: task.description,
      startTime: Date.now(),
    })

    try {
      const targetContent = task.input
      const targetType = this.detectContentType(targetContent)

      const critique = await this.critique(targetContent, targetType, task.id)

      this.updateState({
        status: 'completed',
        endTime: Date.now(),
        progress: 100,
      })

      return this.createSuccessResult(task.id, JSON.stringify(critique), [
        {
          id: uuidv4(),
          type: 'analysis',
          content: JSON.stringify(critique),
          metadata: { type: 'critique', approved: critique.approved },
        },
      ])
    } catch (error) {
      this.updateState({ status: 'error', error: String(error) })
      return this.createFailureResult(task.id, String(error))
    }
  }

  /**
   * Critique content and produce a detailed review
   */
  async critique(
    content: string,
    type: 'code' | 'text' | 'plan' | 'output',
    targetId: string
  ): Promise<Critique> {
    logger.info('LILITH starting critique', { type, contentLength: content.length })

    const issues: CritiqueIssue[] = []

    // Run static analysis for code
    if (type === 'code') {
      const staticIssues = this.staticAnalysis(content)
      issues.push(...staticIssues)
    }

    // Run LLM-based analysis
    const llmIssues = await this.llmAnalysis(content, type)
    issues.push(...llmIssues)

    // Cross-reference with Punk Records for fact-checking
    if (type === 'text' || type === 'output') {
      const factCheckIssues = await this.factCheck(content)
      issues.push(...factCheckIssues)
    }

    // Calculate score (100 - penalty for issues)
    const score = this.calculateScore(issues)

    // Generate recommendation
    const recommendation = await this.generateRecommendation(issues, score)

    const critique: Critique = {
      id: uuidv4(),
      targetId,
      targetType: type,
      issues,
      score,
      recommendation,
      approved: score >= 70 && !issues.some(i => i.severity === 'critical'),
    }

    // Store critique in Punk Records
    await this.storeResult(JSON.stringify(critique), 'critique')

    logger.info('LILITH critique complete', {
      issueCount: issues.length,
      score,
      approved: critique.approved,
    })

    return critique
  }

  /**
   * Detect content type
   */
  private detectContentType(content: string): 'code' | 'text' | 'plan' | 'output' {
    // Check for code indicators
    const codeIndicators = [
      /^(import|export|const|let|var|function|class|interface|type)\s/m,
      /^(def|class|import|from)\s/m,
      /[{}\[\]();]/g,
      /=>/g,
    ]

    let codeScore = 0
    for (const pattern of codeIndicators) {
      if (pattern.test(content)) codeScore++
    }

    if (codeScore >= 2) return 'code'

    // Check for plan indicators
    if (content.includes('"tasks"') || content.includes('"analysis"')) {
      return 'plan'
    }

    return 'text'
  }

  /**
   * Static analysis for code
   */
  private staticAnalysis(code: string): CritiqueIssue[] {
    const issues: CritiqueIssue[] = []

    // Check security patterns
    for (const pattern of this.securityPatterns) {
      const matches = code.match(pattern)
      if (matches) {
        issues.push({
          type: 'security',
          severity: 'critical',
          description: `Potential security vulnerability: ${pattern.source}`,
          location: `Found ${matches.length} occurrence(s)`,
          suggestion: 'Review and sanitize or remove this pattern',
        })
      }
    }

    // Check code smells
    for (const pattern of this.codeSmellPatterns) {
      const matches = code.match(pattern)
      if (matches) {
        issues.push({
          type: 'warning',
          severity: 'minor',
          description: `Code smell detected: ${pattern.source}`,
          location: `Found ${matches.length} occurrence(s)`,
          suggestion: 'Consider refactoring or removing debug code',
        })
      }
    }

    // Check for missing error handling
    if (code.includes('await ') && !code.includes('try') && !code.includes('.catch')) {
      issues.push({
        type: 'error',
        severity: 'major',
        description: 'Async code without error handling',
        suggestion: 'Add try/catch or .catch() for async operations',
      })
    }

    return issues
  }

  /**
   * LLM-based deep analysis
   */
  private async llmAnalysis(content: string, type: string): Promise<CritiqueIssue[]> {
    const prompt = `Analyze this ${type} for issues:

CONTENT:
\`\`\`
${content.slice(0, 3000)}
\`\`\`

Find issues in these categories:
1. Logical errors or flawed reasoning
2. Potential bugs or edge cases
3. Security vulnerabilities
4. Performance concerns
5. Maintainability issues
6. Possible hallucinations or inaccuracies

Respond in JSON format:
{
  "issues": [
    {
      "type": "error|warning|suggestion|security|hallucination",
      "severity": "critical|major|minor|info",
      "description": "What the issue is",
      "location": "Where it is (if applicable)",
      "suggestion": "How to fix it"
    }
  ]
}

If no issues found, return {"issues": []}`

    const response = await this.generate(prompt)
    this.state.iterations++

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { issues: CritiqueIssue[] }
        return parsed.issues || []
      }
    } catch (error) {
      logger.warn('Failed to parse LLM analysis', { error })
    }

    return []
  }

  /**
   * Fact-check content against Punk Records
   */
  private async factCheck(content: string): Promise<CritiqueIssue[]> {
    const issues: CritiqueIssue[] = []

    // Extract claims from content
    const claims = this.extractClaims(content)

    for (const claim of claims.slice(0, 5)) { // Limit to 5 claims for performance
      try {
        const searchResults = await this.punkRecords.search(claim, { limit: 3 })

        if (searchResults.length > 0) {
          // Check if results contradict the claim
          const contradiction = await this.checkContradiction(claim, searchResults)
          if (contradiction) {
            issues.push({
              type: 'hallucination',
              severity: 'major',
              description: `Potential inaccuracy: "${claim}"`,
              suggestion: `Verify against: ${searchResults[0]?.document.content.slice(0, 100)}...`,
            })
          }
        }
      } catch (error) {
        logger.debug('Fact check failed for claim', { claim, error })
      }
    }

    return issues
  }

  /**
   * Extract factual claims from text
   */
  private extractClaims(text: string): string[] {
    // Simple extraction: sentences that look like factual statements
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)

    return sentences
      .filter(s => {
        // Filter out questions and commands
        return !s.trim().startsWith('How') &&
               !s.trim().startsWith('What') &&
               !s.trim().startsWith('Please') &&
               !s.includes('?')
      })
      .slice(0, 10)
  }

  /**
   * Check if search results contradict a claim
   */
  private async checkContradiction(
    _claim: string,
    results: Array<{ document: { content: string }, score: number }>
  ): Promise<boolean> {
    // Simple heuristic: if score is very low, might be contradicting
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length
    return avgScore < 0.3
  }

  /**
   * Calculate quality score based on issues
   */
  private calculateScore(issues: CritiqueIssue[]): number {
    let score = 100

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 25
          break
        case 'major':
          score -= 15
          break
        case 'minor':
          score -= 5
          break
        case 'info':
          score -= 1
          break
      }
    }

    return Math.max(0, score)
  }

  /**
   * Generate a recommendation based on critique
   */
  private async generateRecommendation(
    issues: CritiqueIssue[],
    score: number
  ): Promise<string> {
    if (issues.length === 0) {
      return 'No issues found. The content passes quality checks.'
    }

    if (score >= 90) {
      return 'Minor issues found. Consider addressing them but the content is acceptable.'
    }

    if (score >= 70) {
      return 'Several issues found. Address the major issues before proceeding.'
    }

    if (score >= 50) {
      return 'Significant issues found. The content needs revision before approval.'
    }

    return 'Critical issues detected. The content should not be used as-is. Major revision required.'
  }

  /**
   * Quick check for obvious issues
   */
  quickCheck(content: string): { hasIssues: boolean; criticalCount: number } {
    let criticalCount = 0

    for (const pattern of this.securityPatterns) {
      if (pattern.test(content)) {
        criticalCount++
      }
    }

    return {
      hasIssues: criticalCount > 0,
      criticalCount,
    }
  }
}

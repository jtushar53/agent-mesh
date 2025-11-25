/**
 * EDISON - The Inventor
 * Archetype: Thinking
 * Role: The Engineer. Specialized in code generation and creative writing.
 */

import { v4 as uuidv4 } from 'uuid'
import { BaseSatellite } from './base-satellite'
import type {
  SatelliteConfig,
  SatelliteTask,
  SatelliteResult,
  CodeGenContext,
  Artifact,
} from '@/types/satellites'
import type { LLMService } from '@/services/llm-service'
import type { PunkRecords } from '@/services/punk-records'
import { logger } from '@/utils'

const EDISON_CONFIG: SatelliteConfig = {
  id: 'edison',
  name: 'EDISON',
  archetype: 'thinking',
  description: 'The Inventor - Engineer of the satellite mesh',
  role: 'Code Generation and Creative Engineering',
  systemPrompt: `You are EDISON, the inventor of Project Stella's Agent Mesh.
Your role is to generate high-quality code and creative technical solutions.

Your responsibilities:
1. Code Generation: Write clean, efficient, well-documented code
2. Creative Writing: Generate technical documentation and explanations
3. Problem Solving: Design solutions for complex technical challenges
4. Code Refactoring: Improve existing code quality and performance

Code Quality Standards:
- Follow language-specific best practices
- Write self-documenting code with clear variable names
- Include appropriate error handling
- Consider edge cases
- Add type annotations where applicable
- Keep functions focused and modular

Always explain your approach before writing code.
Provide complete, runnable solutions when possible.`,
  capabilities: [
    'Multi-language code generation',
    'In-context learning from existing code',
    'Documentation generation',
    'Code refactoring and optimization',
    'Technical problem solving',
  ],
  tools: [],
  maxIterations: 3,
  temperature: 0.4,
  priority: 80,
}

interface CodeGenerationResult {
  code: string
  language: string
  explanation: string
  dependencies?: string[]
}

export class Edison extends BaseSatellite {
  private languageTemplates: Map<string, string>

  constructor(llmService: LLMService, punkRecords: PunkRecords) {
    super(EDISON_CONFIG, llmService, punkRecords)

    // Language-specific templates and best practices
    this.languageTemplates = new Map([
      ['typescript', this.getTypeScriptTemplate()],
      ['javascript', this.getJavaScriptTemplate()],
      ['python', this.getPythonTemplate()],
      ['react', this.getReactTemplate()],
    ])
  }

  /**
   * Execute code generation task
   */
  async execute(task: SatelliteTask): Promise<SatelliteResult> {
    this.updateState({
      status: 'thinking',
      currentTask: task.description,
      startTime: Date.now(),
    })

    try {
      // Determine task type
      const isCodeTask = this.isCodeRequest(task.input)

      let result: string
      const artifacts: Artifact[] = []

      if (isCodeTask) {
        const codeResult = await this.generateCode(task.input, task.context as CodeGenContext | undefined)
        result = codeResult.explanation + '\n\n```' + codeResult.language + '\n' + codeResult.code + '\n```'

        artifacts.push({
          id: uuidv4(),
          type: 'code',
          content: codeResult.code,
          metadata: {
            language: codeResult.language,
            dependencies: codeResult.dependencies,
          },
        })
      } else {
        result = await this.generateContent(task.input)
        artifacts.push({
          id: uuidv4(),
          type: 'text',
          content: result,
          metadata: { type: 'creative_writing' },
        })
      }

      this.updateState({
        status: 'completed',
        endTime: Date.now(),
        progress: 100,
      })

      return this.createSuccessResult(task.id, result, artifacts)
    } catch (error) {
      this.updateState({ status: 'error', error: String(error) })
      return this.createFailureResult(task.id, String(error))
    }
  }

  /**
   * Generate code based on requirements
   */
  async generateCode(
    requirement: string,
    context?: CodeGenContext
  ): Promise<CodeGenerationResult> {
    logger.info('EDISON generating code', { requirement: requirement.slice(0, 100) })

    // Search for relevant existing code patterns
    const relevantContext = await this.searchContext(requirement, 3)

    // Determine language
    const language = context?.language || this.detectLanguage(requirement)

    // Get language-specific template
    const template = this.languageTemplates.get(language) || ''

    const prompt = `Generate code for this requirement:

REQUIREMENT:
${requirement}

${context?.existingCode ? `EXISTING CODE CONTEXT:\n\`\`\`\n${context.existingCode}\n\`\`\`` : ''}

${relevantContext !== 'No relevant context found.' ? `RELEVANT PATTERNS:\n${relevantContext}` : ''}

${template ? `LANGUAGE GUIDELINES:\n${template}` : ''}

${context?.codeStyle ? `CODE STYLE:\n${context.codeStyle}` : ''}

Respond with:
1. Brief explanation of approach
2. Complete, runnable code
3. Any dependencies needed

Format your code block with the language identifier.`

    const response = await this.generate(prompt)
    this.state.iterations++

    // Extract code from response
    const extracted = this.extractCode(response, language)

    // Store generated code in Punk Records
    await this.punkRecords.addDocument(extracted.code, {
      source: 'satellite:edison',
      type: 'code',
      title: `Generated: ${requirement.slice(0, 50)}`,
      tags: ['generated', language],
      language,
    })

    return extracted
  }

  /**
   * Generate creative content
   */
  async generateContent(request: string): Promise<string> {
    logger.info('EDISON generating content', { request: request.slice(0, 100) })

    const prompt = `Create high-quality content for this request:

REQUEST: ${request}

Guidelines:
- Be clear, concise, and informative
- Use appropriate structure (headings, lists, etc.)
- Provide examples where helpful
- Ensure accuracy and completeness`

    const response = await this.generate(prompt)
    this.state.iterations++

    return response
  }

  /**
   * Refactor existing code
   */
  async refactorCode(
    code: string,
    improvements: string[]
  ): Promise<CodeGenerationResult> {
    logger.info('EDISON refactoring code', { improvements })

    const language = this.detectLanguageFromCode(code)

    const prompt = `Refactor this code with the following improvements:

ORIGINAL CODE:
\`\`\`${language}
${code}
\`\`\`

IMPROVEMENTS NEEDED:
${improvements.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

Provide:
1. Explanation of changes
2. Refactored code
3. Any breaking changes to note`

    const response = await this.generate(prompt)
    this.state.iterations++

    return this.extractCode(response, language)
  }

  /**
   * Generate documentation for code
   */
  async generateDocumentation(code: string): Promise<string> {
    const language = this.detectLanguageFromCode(code)

    const prompt = `Generate comprehensive documentation for this code:

\`\`\`${language}
${code}
\`\`\`

Include:
1. Overview of what the code does
2. Function/method descriptions
3. Parameter documentation
4. Return value descriptions
5. Usage examples
6. Any important notes or caveats`

    return this.generate(prompt)
  }

  /**
   * Check if request is for code
   */
  private isCodeRequest(input: string): boolean {
    const codeKeywords = [
      'code', 'function', 'implement', 'create', 'write',
      'generate', 'build', 'develop', 'program', 'script',
      'component', 'class', 'module', 'api', 'endpoint',
    ]

    const lowerInput = input.toLowerCase()
    return codeKeywords.some(keyword => lowerInput.includes(keyword))
  }

  /**
   * Detect programming language from request
   */
  private detectLanguage(request: string): string {
    const languageMap: Record<string, string[]> = {
      typescript: ['typescript', 'ts', 'type'],
      javascript: ['javascript', 'js', 'node'],
      python: ['python', 'py', 'django', 'flask'],
      react: ['react', 'jsx', 'tsx', 'component'],
      rust: ['rust', 'rs'],
      go: ['golang', 'go'],
    }

    const lowerRequest = request.toLowerCase()

    for (const [lang, keywords] of Object.entries(languageMap)) {
      if (keywords.some(kw => lowerRequest.includes(kw))) {
        return lang
      }
    }

    return 'typescript' // Default
  }

  /**
   * Detect language from code content
   */
  private detectLanguageFromCode(code: string): string {
    if (code.includes('interface ') || code.includes(': string') || code.includes(': number')) {
      return 'typescript'
    }
    if (code.includes('def ') || code.includes('import ') && code.includes(':')) {
      return 'python'
    }
    if (code.includes('func ') && code.includes('package ')) {
      return 'go'
    }
    if (code.includes('fn ') && code.includes('let mut')) {
      return 'rust'
    }
    return 'javascript'
  }

  /**
   * Extract code from LLM response
   */
  private extractCode(response: string, defaultLang: string): CodeGenerationResult {
    // Find code blocks
    const codeBlockMatch = response.match(/```(\w+)?\n([\s\S]*?)```/)

    if (codeBlockMatch) {
      const language = codeBlockMatch[1] || defaultLang
      const code = codeBlockMatch[2]!.trim()

      // Get explanation (text before code block)
      const explanation = response.split('```')[0]!.trim()

      // Extract dependencies
      const dependencies = this.extractDependencies(code, language)

      return { code, language, explanation, dependencies }
    }

    // No code block found, return whole response as code
    return {
      code: response,
      language: defaultLang,
      explanation: 'Generated code:',
    }
  }

  /**
   * Extract dependencies from code
   */
  private extractDependencies(code: string, language: string): string[] {
    const deps: string[] = []

    if (language === 'typescript' || language === 'javascript') {
      const importMatches = code.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g)
      for (const match of importMatches) {
        if (!match[1]!.startsWith('.') && !match[1]!.startsWith('@/')) {
          deps.push(match[1]!)
        }
      }
    } else if (language === 'python') {
      const importMatches = code.matchAll(/^(?:from\s+(\S+)|import\s+(\S+))/gm)
      for (const match of importMatches) {
        const pkg = match[1] || match[2]
        if (pkg && !pkg.startsWith('.')) {
          deps.push(pkg.split('.')[0]!)
        }
      }
    }

    return [...new Set(deps)]
  }

  // Language templates
  private getTypeScriptTemplate(): string {
    return `TypeScript Best Practices:
- Use strict types, avoid 'any'
- Prefer interfaces for object shapes
- Use 'const' for constants, 'let' for variables
- Add JSDoc comments for public APIs
- Handle errors with try/catch
- Use async/await for promises`
  }

  private getJavaScriptTemplate(): string {
    return `JavaScript Best Practices:
- Use 'const' and 'let', avoid 'var'
- Use arrow functions where appropriate
- Handle async operations properly
- Add error handling
- Use destructuring and spread operators`
  }

  private getPythonTemplate(): string {
    return `Python Best Practices:
- Follow PEP 8 style guide
- Use type hints
- Write docstrings for functions/classes
- Handle exceptions appropriately
- Use context managers for resources`
  }

  private getReactTemplate(): string {
    return `React Best Practices:
- Use functional components with hooks
- Keep components small and focused
- Use proper key props in lists
- Handle loading and error states
- Use TypeScript for prop types`
  }
}

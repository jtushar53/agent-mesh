/**
 * LLM Service
 * Manages client-side LLM inference with WebLLM
 */

import { CreateWebWorkerMLCEngine } from '@mlc-ai/web-llm'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  InferenceStats,
  ModelConfig,
} from '@/types'
import { logger } from '@/utils'

export class LLMService {
  private engine: Awaited<ReturnType<typeof CreateWebWorkerMLCEngine>> | null = null
  private modelLoaded = false
  private currentModel: string | null = null
  private loadStartTime = 0
  private stats: InferenceStats = {
    modelLoaded: false,
    modelName: '',
    loadTime: 0,
    lastInferenceTime: 0,
    tokensPerSecond: 0,
    memoryUsage: 0,
  }

  /**
   * Available models for browser inference
   */
  static readonly MODELS: ModelConfig[] = [
    {
      id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
      name: 'Llama 3.2 1B',
      provider: 'webllm',
      size: '1B',
      quantization: 'q4',
      contextLength: 128000,
      downloadSize: 600,
      capabilities: {
        functionCalling: true,
        streaming: true,
        jsonMode: true,
        multiTurn: true,
      },
    },
    {
      id: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
      name: 'Llama 3.2 3B',
      provider: 'webllm',
      size: '3B',
      quantization: 'q4',
      contextLength: 128000,
      downloadSize: 1800,
      capabilities: {
        functionCalling: true,
        streaming: true,
        jsonMode: true,
        multiTurn: true,
      },
    },
    {
      id: 'Phi-3-mini-4k-instruct-q4f16_1-MLC',
      name: 'Phi-3 Mini',
      provider: 'webllm',
      size: '3B',
      quantization: 'q4',
      contextLength: 4096,
      downloadSize: 2100,
      capabilities: {
        functionCalling: false,
        streaming: true,
        jsonMode: false,
        multiTurn: true,
      },
    },
  ]

  /**
   * Initialize the LLM engine with a specific model
   */
  async initialize(
    modelId: string,
    onProgress?: (progress: { text: string; progress: number }) => void
  ): Promise<void> {
    if (this.modelLoaded && this.currentModel === modelId) {
      logger.info('Model already loaded', { model: modelId })
      return
    }

    logger.info('Initializing LLM engine', { model: modelId })
    this.loadStartTime = Date.now()

    try {
      // Create worker
      const worker = new Worker(
        new URL('../workers/llm-worker.ts', import.meta.url),
        { type: 'module' }
      )

      // Create engine with progress callback
      this.engine = await CreateWebWorkerMLCEngine(worker, modelId, {
        initProgressCallback: (progress) => {
          logger.debug('Model loading progress', {
            text: progress.text,
            progress: progress.progress,
          })
          onProgress?.(progress)
        },
      })

      const loadTime = Date.now() - this.loadStartTime
      this.modelLoaded = true
      this.currentModel = modelId
      this.stats = {
        modelLoaded: true,
        modelName: modelId,
        loadTime,
        lastInferenceTime: 0,
        tokensPerSecond: 0,
        memoryUsage: 0,
      }

      logger.info('LLM engine initialized successfully', {
        model: modelId,
        loadTime,
      })
    } catch (error) {
      logger.error('Failed to initialize LLM engine', {
        model: modelId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Generate chat completion
   */
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.engine || !this.modelLoaded) {
      throw new Error(
        'LLM engine not initialized. Call initialize() first.'
      )
    }

    const startTime = Date.now()
    logger.info('Generating chat completion', {
      messages: request.messages.length,
      stream: request.stream,
    })

    try {
      const completion = await this.engine.chat.completions.create({
        messages: request.messages as any,
        temperature: request.temperature,
        max_tokens: request.maxTokens ?? null,
        top_p: request.topP ?? null,
        stream: false, // Handle streaming separately
      } as any)

      const inferenceTime = Date.now() - startTime

      // Extract response
      const choice = completion.choices[0]
      if (!choice) {
        throw new Error('No completion choice returned')
      }

      const content = choice.message.content ?? ''
      const finishReason = choice.finish_reason as ChatCompletionResponse['finishReason']

      // Update stats
      this.stats.lastInferenceTime = inferenceTime
      if (completion.usage) {
        this.stats.tokensPerSecond =
          completion.usage.completion_tokens / (inferenceTime / 1000)
      }

      logger.info('Chat completion generated', {
        inferenceTime,
        tokensPerSecond: this.stats.tokensPerSecond.toFixed(2),
      })

      const response: ChatCompletionResponse = {
        content,
        finishReason,
      }

      if (completion.usage) {
        response.usage = {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      }

      return response
    } catch (error) {
      logger.error('Chat completion failed', {
        error: error instanceof Error ? error.message : String(error),
      })

      return {
        content: '',
        finishReason: 'error',
      }
    }
  }

  /**
   * Generate chat completion with streaming
   */
  async *chatStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<string, void, unknown> {
    if (!this.engine || !this.modelLoaded) {
      throw new Error(
        'LLM engine not initialized. Call initialize() first.'
      )
    }

    logger.info('Generating streaming chat completion', {
      messages: request.messages.length,
    })

    try {
      const stream = (await this.engine.chat.completions.create({
        messages: request.messages as any,
        temperature: request.temperature,
        max_tokens: request.maxTokens ?? null,
        top_p: request.topP ?? null,
        stream: true,
      } as any)) as unknown as AsyncIterable<any>

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta.content
        if (content) {
          yield content
        }
      }
    } catch (error) {
      logger.error('Streaming chat completion failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Get inference statistics
   */
  getStats(): InferenceStats {
    return { ...this.stats }
  }

  /**
   * Check if model is loaded
   */
  isLoaded(): boolean {
    return this.modelLoaded
  }

  /**
   * Get current model ID
   */
  getCurrentModel(): string | null {
    return this.currentModel
  }

  /**
   * Unload the current model and free memory
   */
  async unload(): Promise<void> {
    if (this.engine) {
      logger.info('Unloading LLM engine')
      // Note: WebLLM doesn't have explicit unload, but we can null the reference
      this.engine = null
      this.modelLoaded = false
      this.currentModel = null
      this.stats.modelLoaded = false
    }
  }

  /**
   * Get model configuration by ID
   */
  static getModelConfig(modelId: string): ModelConfig | undefined {
    return LLMService.MODELS.find((model) => model.id === modelId)
  }

  /**
   * Get recommended model based on capabilities
   */
  static getRecommendedModel(): ModelConfig {
    // For prototype, recommend the smallest model (Llama 3.2 1B)
    return LLMService.MODELS[0]!
  }
}

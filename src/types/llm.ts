/**
 * LLM and inference type definitions
 */

export type LLMProvider = 'webllm' | 'transformers' | 'chrome-ai' | 'api'

export type ModelSize = '0.5B' | '1B' | '3B' | '7B' | '8B'

export type QuantizationType = 'fp32' | 'fp16' | 'int8' | 'int4' | 'q4' | 'q8'

export interface ModelConfig {
  id: string
  name: string
  provider: LLMProvider
  size: ModelSize
  quantization: QuantizationType
  contextLength: number
  downloadSize: number // in MB
  capabilities: ModelCapabilities
}

export interface ModelCapabilities {
  functionCalling: boolean
  streaming: boolean
  jsonMode: boolean
  multiTurn: boolean
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  toolCallId?: string
}

export interface ChatCompletionRequest {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  topP?: number
  topK?: number
  stream?: boolean
  tools?: ToolDefinition[]
}

export interface ChatCompletionResponse {
  content: string
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error'
  usage?: TokenUsage
  toolCalls?: ToolCall[]
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string // JSON string
  }
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface InferenceStats {
  modelLoaded: boolean
  modelName: string
  loadTime: number
  lastInferenceTime: number
  tokensPerSecond: number
  memoryUsage: number // in MB
}

export type BrowserCapability =
  | 'webgpu'
  | 'webassembly'
  | 'workers'
  | 'serviceWorkers'
  | 'indexedDB'
  | 'chromeAI'

export interface BrowserCapabilities {
  webgpu: boolean
  webassembly: boolean
  workers: boolean
  serviceWorkers: boolean
  indexedDB: boolean
  chromeAI: boolean
  recommended: LLMProvider
}

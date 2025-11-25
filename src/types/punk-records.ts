/**
 * Punk Records Type Definitions
 * The multi-modal local database for Project Stella
 */

/**
 * Document stored in Punk Records
 */
export interface PunkDocument {
  id: string
  content: string
  metadata: DocumentMetadata
  embedding?: number[]
  createdAt: number
  updatedAt: number
}

export interface DocumentMetadata {
  source: string
  type: DocumentType
  title?: string
  author?: string
  tags?: string[]
  language?: string
  chunkIndex?: number
  totalChunks?: number
  parentId?: string
  [key: string]: unknown
}

export type DocumentType =
  | 'text'
  | 'code'
  | 'conversation'
  | 'summary'
  | 'memory'
  | 'tool_result'
  | 'user_input'
  | 'agent_output'

/**
 * Search result from Punk Records
 */
export interface SearchResult {
  document: PunkDocument
  score: number
  matchType: 'semantic' | 'keyword' | 'hybrid'
}

/**
 * Vector store configuration
 */
export interface VectorStoreConfig {
  dimensions: number
  metric: 'cosine' | 'euclidean' | 'manhattan'
}

/**
 * Keyword store configuration
 */
export interface KeywordStoreConfig {
  tokenize: 'strict' | 'forward' | 'reverse' | 'full'
  resolution: number
  cache: boolean
}

/**
 * Query options for hybrid search
 */
export interface SearchOptions {
  limit?: number
  threshold?: number
  filter?: Partial<DocumentMetadata>
  includeEmbeddings?: boolean
  searchMode?: 'semantic' | 'keyword' | 'hybrid'
  semanticWeight?: number // 0-1, weight for semantic vs keyword in hybrid mode
}

/**
 * Chunk configuration for text splitting
 */
export interface ChunkConfig {
  chunkSize: number
  chunkOverlap: number
  separator?: string
}

/**
 * Memory types for agent short/long term memory
 */
export interface AgentMemoryEntry {
  id: string
  agentId: string
  type: 'short_term' | 'long_term' | 'working'
  content: string
  importance: number // 0-1 scale
  accessCount: number
  lastAccessed: number
  createdAt: number
  embedding?: number[]
}

/**
 * Context slice for Brain-Brain Cut
 */
export interface ContextSlice {
  id: string
  summary: string
  originalTokenCount: number
  compressedTokenCount: number
  embedding: number[]
  timestamp: number
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
}

/**
 * Graph node for relational data (future Kuzu integration)
 */
export interface GraphNode {
  id: string
  label: string
  properties: Record<string, unknown>
}

/**
 * Graph edge for relational data
 */
export interface GraphEdge {
  id: string
  source: string
  target: string
  label: string
  properties: Record<string, unknown>
}

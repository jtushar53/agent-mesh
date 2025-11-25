/**
 * Punk Records - The Multi-Modal Local Database
 * Combines Vector Store (Voy) + Keyword Store (FlexSearch) for hybrid search
 */

import { Voy } from 'voy-search'
import FlexSearch from 'flexsearch'
import { openDB, type IDBPDatabase } from 'idb'
import { v4 as uuidv4 } from 'uuid'
import type {
  PunkDocument,
  DocumentMetadata,
  SearchResult,
  SearchOptions,
  ChunkConfig,
  AgentMemoryEntry,
  ContextSlice,
} from '@/types/punk-records'
import { logger } from '@/utils'

const DB_NAME = 'punk-records'
const DB_VERSION = 1

/**
 * Punk Records - The Data Layer for Project Stella
 */
export class PunkRecords {
  private db: IDBPDatabase | null = null
  private voyIndex: Voy | null = null
  private flexIndex: any // FlexSearch document index
  private embeddingModel: any = null
  private initialized = false

  constructor() {
    // Initialize FlexSearch with document index
    this.flexIndex = new FlexSearch.Document({
      document: {
        id: 'id',
        index: ['content', 'metadata:title', 'metadata:tags'],
        store: true,
      },
      tokenize: 'forward',
      resolution: 9,
      cache: true,
    })
  }

  /**
   * Initialize Punk Records
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    logger.info('Initializing Punk Records...')

    try {
      // Open IndexedDB
      this.db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Documents store
          if (!db.objectStoreNames.contains('documents')) {
            const docStore = db.createObjectStore('documents', { keyPath: 'id' })
            docStore.createIndex('type', 'metadata.type')
            docStore.createIndex('source', 'metadata.source')
            docStore.createIndex('createdAt', 'createdAt')
          }

          // Memory store for agents
          if (!db.objectStoreNames.contains('memories')) {
            const memStore = db.createObjectStore('memories', { keyPath: 'id' })
            memStore.createIndex('agentId', 'agentId')
            memStore.createIndex('type', 'type')
          }

          // Context slices for Brain-Brain Cut
          if (!db.objectStoreNames.contains('context_slices')) {
            const sliceStore = db.createObjectStore('context_slices', { keyPath: 'id' })
            sliceStore.createIndex('timestamp', 'timestamp')
          }
        },
      })

      // Initialize Voy vector index
      this.voyIndex = new Voy({ embeddings: [] })

      // Load existing documents into memory indices
      await this.loadExistingDocuments()

      this.initialized = true
      logger.info('Punk Records initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize Punk Records', { error })
      throw error
    }
  }

  /**
   * Load existing documents from IndexedDB into memory indices
   */
  private async loadExistingDocuments(): Promise<void> {
    if (!this.db) return

    const documents = await this.db.getAll('documents')
    const embeddings: Array<{ id: string; title: string; url: string; embeddings: number[] }> = []

    for (const doc of documents) {
      // Add to FlexSearch
      this.flexIndex.add(doc)

      // Collect embeddings for Voy
      if (doc.embedding) {
        embeddings.push({
          id: doc.id,
          title: doc.metadata.title || doc.id,
          url: doc.metadata.source || '',
          embeddings: doc.embedding,
        })
      }
    }

    // Rebuild Voy index with all embeddings
    if (embeddings.length > 0) {
      this.voyIndex = new Voy({ embeddings })
    }

    logger.info(`Loaded ${documents.length} documents from storage`)
  }

  /**
   * Generate embedding for text using Transformers.js
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Lazy load the embedding model
    if (!this.embeddingModel) {
      const { pipeline } = await import('@huggingface/transformers')
      this.embeddingModel = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { device: 'webgpu' }
      )
      logger.info('Embedding model loaded')
    }

    const output = await this.embeddingModel(text, {
      pooling: 'mean',
      normalize: true,
    })

    return Array.from(output.data as Float32Array)
  }

  /**
   * Add a document to Punk Records
   */
  async addDocument(
    content: string,
    metadata: DocumentMetadata,
    generateEmbedding = true
  ): Promise<PunkDocument> {
    if (!this.initialized) await this.initialize()

    const now = Date.now()
    const doc: PunkDocument = {
      id: uuidv4(),
      content,
      metadata,
      createdAt: now,
      updatedAt: now,
    }

    // Generate embedding if requested
    if (generateEmbedding) {
      try {
        doc.embedding = await this.generateEmbedding(content)
      } catch (error) {
        logger.warn('Failed to generate embedding', { error })
      }
    }

    // Store in IndexedDB
    await this.db!.put('documents', doc)

    // Add to FlexSearch
    this.flexIndex.add(doc)

    // Add to Voy if we have an embedding
    if (doc.embedding) {
      const currentEmbeddings = this.getAllEmbeddings()
      currentEmbeddings.push({
        id: doc.id,
        title: metadata.title || doc.id,
        url: metadata.source || '',
        embeddings: doc.embedding,
      })
      this.voyIndex = new Voy({ embeddings: currentEmbeddings })
    }

    logger.debug('Document added', { id: doc.id, type: metadata.type })
    return doc
  }

  /**
   * Add multiple documents with chunking
   */
  async addDocumentWithChunking(
    content: string,
    metadata: DocumentMetadata,
    config: ChunkConfig = { chunkSize: 500, chunkOverlap: 50 }
  ): Promise<PunkDocument[]> {
    const chunks = this.chunkText(content, config)
    const documents: PunkDocument[] = []
    const parentId = uuidv4()

    for (let i = 0; i < chunks.length; i++) {
      const chunkMetadata: DocumentMetadata = {
        ...metadata,
        parentId,
        chunkIndex: i,
        totalChunks: chunks.length,
      }
      const doc = await this.addDocument(chunks[i]!, chunkMetadata)
      documents.push(doc)
    }

    return documents
  }

  /**
   * Chunk text into smaller pieces
   */
  private chunkText(text: string, config: ChunkConfig): string[] {
    const { chunkSize, chunkOverlap, separator = '\n\n' } = config
    const chunks: string[] = []

    // First split by separator
    const segments = text.split(separator)
    let currentChunk = ''

    for (const segment of segments) {
      if ((currentChunk + segment).length <= chunkSize) {
        currentChunk += (currentChunk ? separator : '') + segment
      } else {
        if (currentChunk) {
          chunks.push(currentChunk)
        }
        // Handle segments longer than chunkSize
        if (segment.length > chunkSize) {
          // Split long segment by words
          const words = segment.split(' ')
          currentChunk = ''
          for (const word of words) {
            if ((currentChunk + ' ' + word).length <= chunkSize) {
              currentChunk += (currentChunk ? ' ' : '') + word
            } else {
              if (currentChunk) chunks.push(currentChunk)
              currentChunk = word
            }
          }
        } else {
          currentChunk = segment
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk)
    }

    // Add overlap between chunks
    if (chunkOverlap > 0 && chunks.length > 1) {
      const overlappedChunks: string[] = []
      for (let i = 0; i < chunks.length; i++) {
        let chunk = chunks[i]!
        if (i > 0) {
          const prevChunk = chunks[i - 1]!
          const overlapText = prevChunk.slice(-chunkOverlap)
          chunk = overlapText + ' ' + chunk
        }
        overlappedChunks.push(chunk)
      }
      return overlappedChunks
    }

    return chunks
  }

  /**
   * Get all embeddings for Voy reconstruction
   */
  private getAllEmbeddings(): Array<{ id: string; title: string; url: string; embeddings: number[] }> {
    // This is a workaround since Voy doesn't expose its internal embeddings
    return []
  }

  /**
   * Semantic search using Voy
   */
  async semanticSearch(query: string, limit = 10): Promise<SearchResult[]> {
    if (!this.initialized) await this.initialize()

    try {
      const queryEmbedding = await this.generateEmbedding(query)
      const results = this.voyIndex!.search(new Float32Array(queryEmbedding), limit)

      const searchResults: SearchResult[] = []
      const neighbors = (results as any).neighbors || []
      for (const neighbor of neighbors) {
        const doc = await this.db!.get('documents', neighbor.id)
        if (doc) {
          searchResults.push({
            document: doc,
            score: 1 - (neighbor.distance || 0), // Convert distance to similarity
            matchType: 'semantic',
          })
        }
      }

      return searchResults
    } catch (error) {
      logger.error('Semantic search failed', { error })
      return []
    }
  }

  /**
   * Keyword search using FlexSearch
   */
  async keywordSearch(query: string, limit = 10): Promise<SearchResult[]> {
    if (!this.initialized) await this.initialize()

    try {
      const results = this.flexIndex.search(query, { limit, enrich: true })
      const searchResults: SearchResult[] = []

      for (const field of results) {
        for (const result of field.result) {
          const doc = result.doc as PunkDocument
          // Avoid duplicates
          if (!searchResults.find(r => r.document.id === doc.id)) {
            searchResults.push({
              document: doc,
              score: 1 / (searchResults.length + 1), // Simple ranking
              matchType: 'keyword',
            })
          }
        }
      }

      return searchResults.slice(0, limit)
    } catch (error) {
      logger.error('Keyword search failed', { error })
      return []
    }
  }

  /**
   * Hybrid search combining semantic and keyword search
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      limit = 10,
      threshold = 0,
      searchMode = 'hybrid',
      semanticWeight = 0.7,
    } = options

    if (searchMode === 'semantic') {
      return this.semanticSearch(query, limit)
    }

    if (searchMode === 'keyword') {
      return this.keywordSearch(query, limit)
    }

    // Hybrid search
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticSearch(query, limit * 2),
      this.keywordSearch(query, limit * 2),
    ])

    // Combine and re-rank results
    const combinedMap = new Map<string, SearchResult>()

    // Add semantic results with weight
    for (const result of semanticResults) {
      combinedMap.set(result.document.id, {
        ...result,
        score: result.score * semanticWeight,
        matchType: 'hybrid',
      })
    }

    // Add keyword results with weight
    const keywordWeight = 1 - semanticWeight
    for (const result of keywordResults) {
      const existing = combinedMap.get(result.document.id)
      if (existing) {
        existing.score += result.score * keywordWeight
      } else {
        combinedMap.set(result.document.id, {
          ...result,
          score: result.score * keywordWeight,
          matchType: 'hybrid',
        })
      }
    }

    // Sort by combined score and filter by threshold
    const results = Array.from(combinedMap.values())
      .filter(r => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return results
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string): Promise<PunkDocument | undefined> {
    if (!this.initialized) await this.initialize()
    return this.db!.get('documents', id)
  }

  /**
   * Delete document by ID
   */
  async deleteDocument(id: string): Promise<void> {
    if (!this.initialized) await this.initialize()

    await this.db!.delete('documents', id)
    // Note: FlexSearch and Voy would need to be rebuilt for full deletion
    logger.debug('Document deleted', { id })
  }

  /**
   * Store agent memory
   */
  async storeMemory(entry: Omit<AgentMemoryEntry, 'id'>): Promise<AgentMemoryEntry> {
    if (!this.initialized) await this.initialize()

    const memory: AgentMemoryEntry = {
      ...entry,
      id: uuidv4(),
    }

    // Generate embedding for memory content
    try {
      memory.embedding = await this.generateEmbedding(entry.content)
    } catch (error) {
      logger.warn('Failed to generate memory embedding', { error })
    }

    await this.db!.put('memories', memory)
    return memory
  }

  /**
   * Get memories for an agent
   */
  async getAgentMemories(
    agentId: string,
    type?: 'short_term' | 'long_term' | 'working'
  ): Promise<AgentMemoryEntry[]> {
    if (!this.initialized) await this.initialize()

    let memories = await this.db!.getAllFromIndex('memories', 'agentId', agentId)

    if (type) {
      memories = memories.filter(m => m.type === type)
    }

    return memories.sort((a, b) => b.importance - a.importance)
  }

  /**
   * Store context slice for Brain-Brain Cut
   */
  async storeContextSlice(slice: Omit<ContextSlice, 'id'>): Promise<ContextSlice> {
    if (!this.initialized) await this.initialize()

    const contextSlice: ContextSlice = {
      ...slice,
      id: uuidv4(),
    }

    await this.db!.put('context_slices', contextSlice)
    logger.info('Context slice stored', {
      id: contextSlice.id,
      originalTokens: slice.originalTokenCount,
      compressedTokens: slice.compressedTokenCount,
    })

    return contextSlice
  }

  /**
   * Get recent context slices
   */
  async getRecentContextSlices(limit = 10): Promise<ContextSlice[]> {
    if (!this.initialized) await this.initialize()

    const slices = await this.db!.getAllFromIndex('context_slices', 'timestamp')
    return slices.slice(-limit).reverse()
  }

  /**
   * Search similar context slices
   */
  async searchContextSlices(query: string, limit = 5): Promise<ContextSlice[]> {
    if (!this.initialized) await this.initialize()

    const queryEmbedding = await this.generateEmbedding(query)
    const slices = await this.db!.getAll('context_slices')

    // Calculate similarity scores
    const scored = slices.map(slice => ({
      slice,
      score: this.cosineSimilarity(queryEmbedding, slice.embedding),
    }))

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.slice)
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!
      normA += a[i]! * a[i]!
      normB += b[i]! * b[i]!
    }

    if (normA === 0 || normB === 0) return 0
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * Get statistics about stored data
   */
  async getStats(): Promise<{
    documents: number
    memories: number
    contextSlices: number
  }> {
    if (!this.initialized) await this.initialize()

    const [documents, memories, contextSlices] = await Promise.all([
      this.db!.count('documents'),
      this.db!.count('memories'),
      this.db!.count('context_slices'),
    ])

    return { documents, memories, contextSlices }
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    if (!this.initialized) await this.initialize()

    await Promise.all([
      this.db!.clear('documents'),
      this.db!.clear('memories'),
      this.db!.clear('context_slices'),
    ])

    // Reset indices
    this.voyIndex = new Voy({ embeddings: [] })
    this.flexIndex = new FlexSearch.Document({
      document: {
        id: 'id',
        index: ['content', 'metadata:title', 'metadata:tags'],
        store: true,
      },
    })

    logger.info('Punk Records cleared')
  }
}

// Singleton instance
export const punkRecords = new PunkRecords()

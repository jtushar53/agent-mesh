/**
 * WebLLM Worker
 * Handles LLM inference in a separate thread to avoid blocking the UI
 */

import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

// Create the worker handler
const handler = new WebWorkerMLCEngineHandler()

// Handle messages from the main thread
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg)
}

export {}

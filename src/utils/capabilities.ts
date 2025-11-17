/**
 * Browser AI Capabilities Detection
 * Detects available browser features for AI/ML workloads
 */

import type { BrowserCapabilities, LLMProvider } from '@/types'

export class BrowserAICapabilities {
  /**
   * Detect all browser AI capabilities
   */
  static async detect(): Promise<BrowserCapabilities> {
    const capabilities: BrowserCapabilities = {
      webgpu: await this.checkWebGPU(),
      webassembly: this.checkWebAssembly(),
      workers: this.checkWorkers(),
      serviceWorkers: this.checkServiceWorkers(),
      indexedDB: this.checkIndexedDB(),
      chromeAI: await this.checkChromeAI(),
      recommended: 'api', // Default fallback
    }

    // Determine recommended provider based on capabilities
    capabilities.recommended = this.getRecommendedProvider(capabilities)

    return capabilities
  }

  /**
   * Check WebGPU availability
   */
  static async checkWebGPU(): Promise<boolean> {
    if (!('gpu' in navigator)) {
      return false
    }

    try {
      const adapter = await (navigator.gpu as any).requestAdapter()
      return !!adapter
    } catch (error) {
      console.warn('WebGPU check failed:', error)
      return false
    }
  }

  /**
   * Check WebAssembly support
   */
  static checkWebAssembly(): boolean {
    return typeof WebAssembly !== 'undefined'
  }

  /**
   * Check Web Workers support
   */
  static checkWorkers(): boolean {
    return typeof Worker !== 'undefined'
  }

  /**
   * Check Service Workers support
   */
  static checkServiceWorkers(): boolean {
    return 'serviceWorker' in navigator
  }

  /**
   * Check IndexedDB support
   */
  static checkIndexedDB(): boolean {
    return 'indexedDB' in window
  }

  /**
   * Check Chrome Built-in AI (Gemini Nano)
   */
  static async checkChromeAI(): Promise<boolean> {
    try {
      // Check for Chrome AI experimental APIs
      // @ts-expect-error - Chrome AI APIs are experimental
      if (!window.ai?.languageModel) {
        return false
      }

      // @ts-expect-error - Chrome AI APIs are experimental
      const capabilities = await window.ai.languageModel.capabilities()
      return capabilities.available === 'readily'
    } catch (error) {
      return false
    }
  }

  /**
   * Determine recommended LLM provider based on capabilities
   */
  static getRecommendedProvider(
    capabilities: BrowserCapabilities
  ): LLMProvider {
    // Priority order: Chrome AI > WebLLM (WebGPU) > Transformers.js (WASM) > API
    if (capabilities.chromeAI) {
      return 'chrome-ai'
    }

    if (capabilities.webgpu && capabilities.workers) {
      return 'webllm'
    }

    if (capabilities.webassembly && capabilities.workers) {
      return 'transformers'
    }

    return 'api'
  }

  /**
   * Get human-readable capability report
   */
  static getCapabilityReport(capabilities: BrowserCapabilities): string {
    const lines: string[] = [
      '🔍 Browser AI Capabilities Report',
      '================================',
      '',
      `✓ WebGPU: ${capabilities.webgpu ? '✅ Available' : '❌ Not available'}`,
      `✓ WebAssembly: ${capabilities.webassembly ? '✅ Available' : '❌ Not available'}`,
      `✓ Web Workers: ${capabilities.workers ? '✅ Available' : '❌ Not available'}`,
      `✓ Service Workers: ${capabilities.serviceWorkers ? '✅ Available' : '❌ Not available'}`,
      `✓ IndexedDB: ${capabilities.indexedDB ? '✅ Available' : '❌ Not available'}`,
      `✓ Chrome AI: ${capabilities.chromeAI ? '✅ Available (Gemini Nano)' : '❌ Not available'}`,
      '',
      `📊 Recommended Provider: ${capabilities.recommended.toUpperCase()}`,
      '',
    ]

    // Add recommendations
    if (capabilities.webgpu) {
      lines.push(
        '💡 WebGPU is available - you can run high-performance LLM inference locally!'
      )
    } else if (capabilities.webassembly) {
      lines.push(
        '💡 WebGPU not available, but WebAssembly can provide CPU-based inference.'
      )
    } else {
      lines.push(
        '⚠️  Limited local inference capabilities. Consider using API-based inference.'
      )
    }

    return lines.join('\n')
  }

  /**
   * Check if secure context (HTTPS or localhost)
   */
  static isSecureContext(): boolean {
    return window.isSecureContext
  }

  /**
   * Check for SharedArrayBuffer support (required for WASM multi-threading)
   */
  static checkSharedArrayBuffer(): boolean {
    return typeof SharedArrayBuffer !== 'undefined'
  }

  /**
   * Get WebGPU adapter info if available
   */
  static async getWebGPUInfo(): Promise<{
    vendor?: string
    architecture?: string
    device?: string
  } | null> {
    if (!('gpu' in navigator)) {
      return null
    }

    try {
      const adapter = await (navigator.gpu as any).requestAdapter()
      if (!adapter) {
        return null
      }

      const info = await adapter.requestAdapterInfo()
      return {
        vendor: info.vendor,
        architecture: info.architecture,
        device: info.device,
      }
    } catch (error) {
      console.warn('Could not get WebGPU info:', error)
      return null
    }
  }
}

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/store': path.resolve(__dirname, './src/store'),
      '@/agents': path.resolve(__dirname, './src/agents'),
      '@/satellites': path.resolve(__dirname, './src/satellites'),
      '@/utils': path.resolve(__dirname, './src/utils'),
    },
  },
  server: {
    port: 5173,
    headers: {
      // Required for SharedArrayBuffer (WebAssembly multi-threading)
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm', '@huggingface/transformers', 'voy-search'],
  },
  worker: {
    format: 'es',
  },
})

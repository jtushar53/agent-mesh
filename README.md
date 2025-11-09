# AgentMesh

> **Educational Project** - This is a personal study project exploring browser-based AI agents with MCP integration. Built for learning purposes only.

A prototype framework for building AI agents that run entirely in the browser using the Model Context Protocol and client-side LLM inference.

## Development Instructions

### Prerequisites

- Node.js 18+
- Modern browser with WebGPU support (Chrome 113+, Edge 113+, Safari 18+)

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the development server**
   ```bash
   npm run dev
   ```
   App runs at: http://localhost:5173

3. **Start the Mock MCP Server** (optional, for testing)
   ```bash
   cd mcp-server
   npm install
   npm start
   ```
   MCP server runs at: http://localhost:3001

### Testing

```bash
npm test          # Run Playwright tests
npm run test:ui   # Run tests in UI mode
```

## Project Structure

```
AgentMesh/
├── src/
│   ├── agents/              # AI agent implementations
│   │   └── react-agent.ts       # ReAct pattern agent
│   ├── components/          # React UI components
│   │   ├── Dashboard.tsx        # Main dashboard with tabs
│   │   ├── LLMTester.tsx        # Model loading & testing
│   │   ├── AgentViewer.tsx      # Agent execution interface
│   │   └── MCPManager.tsx       # MCP server connections
│   ├── services/            # Core services
│   │   ├── mcp-client.ts        # MCP browser client
│   │   └── llm-service.ts       # WebLLM wrapper
│   ├── store/               # State management (Zustand)
│   │   └── app-store.ts         # Central app state
│   ├── types/               # TypeScript definitions
│   │   ├── agent.ts             # Agent types
│   │   ├── llm.ts               # LLM types
│   │   ├── mcp.ts               # MCP types
│   │   └── workflow.ts          # Workflow types
│   ├── utils/               # Utilities
│   │   ├── capabilities.ts      # Browser capability detection
│   │   └── logger.ts            # Logging utility
│   └── workers/             # Web Workers
│       └── llm-worker.ts        # LLM inference worker
├── mcp-server/              # Mock MCP server for testing
│   └── server.js                # Express server with demo tools
├── tests/                   # Playwright E2E tests
    └── mcp-integration.spec.ts
```

## Available MCP Tools

The mock MCP server provides these demo tools:

| Tool | Description | Input Example |
|------|-------------|---------------|
| `calculator` | Performs math calculations | `{ "expression": "2 + 2" }` |
| `get_time` | Returns current server time | `{}` |
| `reverse_text` | Reverses text strings | `{ "text": "Hello" }` |
| `word_count` | Counts words and characters | `{ "text": "Hello World" }` |

### Connecting to Real MCP Servers

Use the **JSON Config** mode in the MCP Manager to connect to multiple servers:

```json
{
  "mcpServers": {
    "demo-server": {
      "url": "http://localhost:3001/mcp",
      "description": "Local demo server"
    },
    "huggingface-mcp": {
      "url": "http://localhost:3002/mcp",
      "description": "Hugging Face integration"
    }
  }
}
```

## WebLLM Models

Supported models for client-side inference:

| Model | Size | Download Size | Context Length | Function Calling |
|-------|------|---------------|----------------|------------------|
| Llama-3.2-1B-Instruct-q4f32_1-MLC | 1B params | ~600MB | 128K | ✅ |
| Llama-3.2-3B-Instruct-q4f32_1-MLC | 3B params | ~1.8GB | 128K | ✅ |
| Phi-3-mini-4k-instruct-q4f16_1-MLC | 3.8B params | ~2.1GB | 4K | ❌ |

### Quantization

All models use **INT4 quantization** (q4f32_1-MLC format) for optimal browser performance:

- **Size Reduction**: ~87.5% smaller than FP32 models
- **Accuracy Loss**: ~2-5% compared to full precision
- **Performance**: Optimized for WebGPU acceleration
- **Memory**: Fits within typical browser memory constraints

The quantization format (q4f32_1) means:
- `q4` = 4-bit integer quantization for weights
- `f32` = 32-bit float for activations
- `_1` = Version 1 of the quantization scheme
- `-MLC` = Machine Learning Compilation format

## Tech Stack

- **Frontend**: React 18 + TypeScript (strict mode)
- **Build**: Vite 6 with SharedArrayBuffer headers
- **State**: Zustand + localStorage persistence
- **ML Inference**: WebLLM (WebGPU) + Transformers.js (WASM fallback)
- **MCP**: @modelcontextprotocol/sdk
- **Testing**: Playwright
- **Validation**: Zod schemas

## License

MIT - Educational use only

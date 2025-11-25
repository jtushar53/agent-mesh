# 🍎 PROJECT STELLA: The Local Intelligence OS

> **"The World's Intelligence, Disconnected."**

**Project Stella** is a browser-native, privacy-first **Agent Mesh** powered by WebGPU. It brings the architecture of a sophisticated Multi-Agent System to your local machine, requiring zero internet and zero monthly fees.

Inspired by the distributed cognition of **Dr. Vegapunk**, Stella splits intelligence into specialized "Satellites"—autonomous agents that Plan, Code, Research, and Execute—all sharing a single, local Vector Database known as **Punk Records**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![WebGPU](https://img.shields.io/badge/WebGPU-Accelerated-green)](https://gpuweb.github.io/gpuweb/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## 🏗️ Core Architecture

Stella creates an "Air-Gapped" Intelligence Environment inside the user's browser.

### The Tech Stack
* **Runtime Environment:** Browser (Chrome/Edge/Arc/Safari) via **WebGPU**.
* **Inference Engine:** `WebLLM` (MLC AI) for running quantized LLMs (Llama-3, Phi-3, Qwen).
* **Orchestration:** `LangChain.js` / Custom State Graph (DAG).
* **Tooling Protocol:** **MCP (Model Context Protocol)** for standardizing tool connections.

### The Data Layer: "Punk Records"
Instead of a simple file upload, we utilize a multi-modal local database:
1.  **Vector Store (Semantic):** `Voy` (WASM-based) for understanding concepts.
2.  **Keyword Store (Exact):** `FlexSearch` for retrieving IDs, Error Codes, and Syntax.
3.  **Graph Store (Relational):** `Kuzu-WASM` (Planned) to link entities and concepts.

**🔒 Privacy Guarantee:** All data processing happens in `IndexedDB` within the browser sandbox. No data ever leaves the user's device.

---

## 📡 The Satellite System (Agent Mesh)

Stella is not a chatbot. It is a mesh of 6 specialized agents, each optimized for a specific cognitive domain.

### 01. SHAKA (The Orchestrator)
* **Archetype:** Logic & Good.
* **Role:** The CEO. Shaka parses user intent, breaks it into a Dependency Graph (DAG), and assigns sub-tasks to other satellites.
* **Intelligence Upgrade:**
    * **Reflection Loops:** Shaka simulates the outcome of a plan before executing it.
    * **Structured Output:** Strictly enforces JSON Schema for all internal communication.
* **Future Proofing:** Will support "long-horizon planning" to manage tasks that take days to complete.

### 02. LILITH (The Critic)
* **Archetype:** Evil (Malice against errors).
* **Role:** The Red Teamer. Lilith monitors outputs for hallucinations, bugs, and security risks.
* **Intelligence Upgrade:**
    * **Static Analysis:** Runs WASM-based linters (ESLint/Ruff) on generated code.
    * **Fact Checking:** Cross-references answers against *Punk Records* to detect hallucinations.
* **Future Proofing:** Automated Adversarial Testing to attempt to "break" the system's logic.

### 03. EDISON (The Inventor)
* **Archetype:** Thinking.
* **Role:** The Engineer. Specialized in code generation and creative writing.
* **Intelligence Upgrade:**
    * **In-Context Learning:** Automatically pulls the user's existing codebase style into the context window.
    * **Documentation RAG:** Has exclusive priority access to technical documentation indices.
* **Future Proofing:** Integration with **WebContainer API** to execute and test code directly in the browser tab.

### 04. PYTHAGORAS (The Researcher)
* **Archetype:** Wisdom.
* **Role:** Data Retrieval & Synthesis.
* **Intelligence Upgrade:**
    * **GraphRAG Lite:** Traverses knowledge graphs to find hidden connections between documents.
    * **Query Expansion:** Generates 5+ search variations to ensure maximum recall.
* **Future Proofing:** Multi-modal indexing (OCR for images/diagrams) to "read" screenshots and whiteboards.

### 05. ATLAS (The Warrior)
* **Archetype:** Violence (Action).
* **Role:** The Tool Executor. The interface between the AI and the outside world.
* **Intelligence Upgrade:**
    * **MCP Host:** Acts as the dedicated client for all Model Context Protocol servers.
    * **Self-Correction:** Analyzes API error codes (e.g., 500 vs 404) and adjusts parameters automatically.
* **Future Proofing:** Headless browser automation for navigating websites without APIs.

### 06. YORK (The Manager)
* **Archetype:** Greed.
* **Role:** Resource & Optimization Manager.
* **Intelligence Upgrade:**
    * **Context Eviction:** Intelligently summarizes and "forgets" old conversation turns to save RAM.
    * **Dynamic Quantization:** Swaps models based on battery life (e.g., Llama-3-8B -> Phi-3-Mini).
* **Future Proofing:** Distributed Compute—offloading inference to other devices on the local LAN.

---

## 💾 Feature Deep Dives

### "The Brain-Brain Cut" (Context Slicing)
* **Problem:** Browser memory is limited.
* **Solution:** When the context window fills, York triggers a "Cut." The oldest segment is summarized into a high-density vector and stored in *Punk Records*, keeping the "Active RAM" fresh while preserving long-term memory.

### "Den Den Mushi" Protocol (MCP Integration)
* **Visual Indicator:** A status icon representing the connection state.
    * 🐌 **Sleep:** Offline / Air-gapped.
    * 🐌📢 **Call:** Tool Execution in progress.
    * 🐌✨ **Signal:** Data received from external source.

---

## 🎨 UI/UX Philosophy: "Egghead Aesthetics"

The interface rejects the sterile "SaaS" look in favor of a **Cyber-Future-Retro** aesthetic.

* **Visual Language:** Rounded corners, holographic overlays, and terminal-style typography.
* **The Log Pose:** The navigation menu is replaced by a "Log Pose" timeline, tracking the user's journey through tasks.
* **Lab Atmosphere:** The background and color palette mimic a high-tech laboratory (White, Holographic Blue, Neon Pink accents).

---

## 🚀 Getting Started

### Prerequisites
* A WebGPU-enabled browser (Chrome 113+, Edge, Arc).
* A GPU with at least 4GB VRAM recommended.

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/project-stella.git

# Install dependencies
npm install

# Run the local development lab
npm run dev
```

**First-time setup:**
1. Open http://localhost:5173 in Chrome/Edge 113+ or Safari 18+
2. Navigate to "LLM Tester" tab
3. Select a model (recommend: Llama-3.2-3B for best quality)
4. Click "Load Model" (~1.8GB download, one-time)
5. Start chatting!

---

## 🛠️ Tech Stack

**Frontend:**
- React 18.3.1 with TypeScript 5.6 (strict mode)
- Vite 6.0.1 (build tool with HMR)
- Zustand 4.5.5 (state management)
- ReactFlow 11.11.4 (workflow visualization)

**AI/ML:**
- WebLLM 0.2.72 (browser LLM inference)
- Transformers.js 3.1.2 (WASM fallback)
- MCP SDK 1.0.4 (Model Context Protocol)

**Storage & Validation:**
- IndexedDB (via idb 8.0.0) - Browser storage
- Voy (WASM) - Vector Store
- FlexSearch - Keyword Search
- Zod 3.23.8 - Runtime type validation

**Testing:**
- Playwright 1.48.2 - E2E browser testing

---

## 🗺️ Roadmap

### Phase 1: Foundation (Current)
- [x] Core agent framework
- [x] WebGPU inference engine
- [x] MCP integration
- [ ] Punk Records (Vector + Keyword Store)

### Phase 2: Satellite System
- [ ] SHAKA (Orchestrator) implementation
- [ ] LILITH (Critic) implementation
- [ ] EDISON (Inventor) implementation
- [ ] PYTHAGORAS (Researcher) implementation
- [ ] ATLAS (Warrior) implementation
- [ ] YORK (Manager) implementation

### Phase 3: Intelligence Upgrades
- [ ] GraphRAG Lite
- [ ] Brain-Brain Cut (Context Slicing)
- [ ] Dynamic Quantization
- [ ] Reflection Loops

### Phase 4: Future Proofing
- [ ] Kuzu-WASM Graph Store
- [ ] WebContainer Integration
- [ ] Multi-modal indexing (OCR)
- [ ] Distributed Compute (LAN)

---

## 🤝 Contributing

We love contributions! Project Stella is built by developers, for developers.

### Ways to Contribute

- 🐛 **Report bugs** - Open an issue
- 💡 **Suggest features** - Share your ideas in Discussions
- 📖 **Improve docs** - Help others get started
- 🔧 **Submit PRs** - Fix bugs or add features
- ⭐ **Star the repo** - Show your support!

### Getting Started

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly (`npm test`)
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

**Educational Project:** Built as a learning exploration of browser-based AI. Free to use, modify, and distribute.

---

## 🙏 Acknowledgments

Built with amazing open-source technologies:

- [WebLLM](https://github.com/mlc-ai/web-llm) - Browser LLM inference
- [Model Context Protocol](https://modelcontextprotocol.io/) - Tool integration standard
- [React](https://react.dev/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool
- [Zustand](https://github.com/pmndrs/zustand) - State management

Inspired by the genius of **Dr. Vegapunk** and the concept of distributed cognition.

---

<div align="center">

**Built with ❤️ by developers who believe AI should be accessible, private, and free**

**"The World's Intelligence, Disconnected."**

[⬆ Back to Top](#-project-stella-the-local-intelligence-os)

</div>

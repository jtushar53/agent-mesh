/**
 * Dashboard Component
 * Main interface with tabbed navigation between different features
 */

import { useState } from 'react'
import { LLMTester } from './LLMTester'
import { AgentViewer } from './AgentViewer'
import { MCPManager } from './MCPManager'
import './Dashboard.css'

type TabId = 'capabilities' | 'llm' | 'agent' | 'mcp'

interface Tab {
  id: TabId
  label: string
  icon: string
  component?: React.ReactNode
}

const tabs: Tab[] = [
  {
    id: 'llm',
    label: 'LLM Testing',
    icon: '🧠',
  },
  {
    id: 'agent',
    label: 'Agent Execution',
    icon: '🤝',
  },
  {
    id: 'mcp',
    label: 'MCP Tools',
    icon: '🔌',
  },
]

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('llm')

  const renderTabContent = () => {
    switch (activeTab) {
      case 'llm':
        return <LLMTester />
      case 'agent':
        return <AgentViewer />
      case 'mcp':
        return <MCPManager />
      default:
        return null
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>🤖 AgentMesh</h1>
          <p className="tagline">MCP-Powered Browser Agent Framework</p>
        </div>
      </header>

      <div className="dashboard-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <main className="dashboard-content">{renderTabContent()}</main>
    </div>
  )
}

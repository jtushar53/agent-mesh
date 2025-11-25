import { useEffect } from 'react'
import './styles/theme.css'
import './App.css'
import { BrowserAICapabilities } from '@/utils'
import { useAppStore } from '@/store'
import { StellaLayout } from '@/components/stella'

function App() {
  const { setCapabilities } = useAppStore()

  useEffect(() => {
    // Auto-check capabilities on mount
    const checkCapabilities = async () => {
      try {
        const caps = await BrowserAICapabilities.detect()
        setCapabilities(caps)
        console.log('Browser Capabilities:', caps)
      } catch (error) {
        console.error('Failed to check capabilities:', error)
      }
    }
    void checkCapabilities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <StellaLayout />
}

export default App

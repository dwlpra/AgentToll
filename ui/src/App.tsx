import { Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Navbar } from './components/Navbar'
import { Landing } from './pages/Landing'
import { ProviderDashboard } from './pages/ProviderDashboard'
import { AgentBridge } from './pages/AgentBridge'
import { Articles } from './pages/Articles'

export default function App() {
  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/provider" element={<ProviderDashboard />} />
          <Route path="/agent" element={<AgentBridge />} />
          <Route path="/articles" element={<Articles />} />
        </Routes>
      </AnimatePresence>
    </div>
  )
}

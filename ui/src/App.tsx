import { Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Navbar } from './components/Navbar'
import { Landing } from './pages/Landing'
import { ProviderDashboard } from './pages/ProviderDashboard'
import { AgentBridge } from './pages/AgentBridge'
import { Articles } from './pages/Articles'
import { RolePickerModal } from './components/RolePickerModal'
import { RoleProvider, useRole } from './hooks/useRole'
import { useAccount } from 'wagmi'

function AppInner() {
  const { address } = useAccount()
  const { needsRoleSelection, setRole, isWhitelistedProvider } = useRole()

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <RolePickerModal
        open={needsRoleSelection && !!address}
        address={address ?? ''}
        isWhitelistedProvider={isWhitelistedProvider}
        onSelect={setRole}
      />
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

export default function App() {
  return (
    <RoleProvider>
      <AppInner />
    </RoleProvider>
  )
}

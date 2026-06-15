import { useState, useEffect, useCallback, createContext, useContext, createElement, type ReactNode } from 'react'
import { useAccount } from 'wagmi'

// Hardcoded provider whitelist
export const PROVIDER_WALLET = '0x277B284B7c3D9ccc1a819c89e0378FB585085f6D'

export type Role = 'agent' | 'provider'

const ROLE_KEY = 'paycrawl:role'
const WALLET_KEY = 'paycrawl:role-wallet'

function loadStoredRole(wallet: string): Role | null {
  try {
    const storedWallet = localStorage.getItem(WALLET_KEY)
    const storedRole = localStorage.getItem(ROLE_KEY) as Role | null
    // Role only valid if same wallet
    if (storedWallet === wallet) return storedRole
    // Different wallet — clear stale role
    if (storedRole) {
      localStorage.removeItem(ROLE_KEY)
      localStorage.removeItem(WALLET_KEY)
    }
    return null
  } catch {
    return null
  }
}

function saveRole(wallet: string, role: Role) {
  try {
    localStorage.setItem(ROLE_KEY, role)
    localStorage.setItem(WALLET_KEY, wallet)
  } catch {
    // ignore
  }
}

function clearRole() {
  try {
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(WALLET_KEY)
  } catch {
    // ignore
  }
}

interface RoleContextValue {
  role: Role | null
  needsRoleSelection: boolean
  isProvider: boolean
  isWhitelistedProvider: boolean
  setRole: (role: Role) => void
  setNeedsRoleSelection: (v: boolean) => void
}

const RoleContext = createContext<RoleContextValue>({
  role: null,
  needsRoleSelection: false,
  isProvider: false,
  isWhitelistedProvider: false,
  setRole: () => {},
  setNeedsRoleSelection: () => {},
})

export function RoleProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount()
  const [role, setRoleState] = useState<Role | null>(null)
  const [needsRoleSelection, setNeedsRoleSelection] = useState(false)

  useEffect(() => {
    if (!address) {
      setRoleState(null)
      setNeedsRoleSelection(false)
      return
    }

    const stored = loadStoredRole(address.toLowerCase())

    if (!stored) {
      // No valid role for this wallet — show picker
      setRoleState(null)
      setNeedsRoleSelection(true)
      return
    }

    // Validate: if role is provider but wallet not whitelisted, demote
    if (stored === 'provider' && address.toLowerCase() !== PROVIDER_WALLET.toLowerCase()) {
      setRoleState('agent')
      saveRole(address.toLowerCase(), 'agent')
      setNeedsRoleSelection(false)
      return
    }

    setRoleState(stored)
    setNeedsRoleSelection(false)
  }, [address])

  const setRole = useCallback((newRole: Role) => {
    if (address) {
      setRoleState(newRole)
      saveRole(address.toLowerCase(), newRole)
    }
    setNeedsRoleSelection(false)
  }, [address])

  const isWhitelistedProvider = address?.toLowerCase() === PROVIDER_WALLET.toLowerCase()
  const isProvider = role === 'provider' && isWhitelistedProvider

  return createElement(RoleContext.Provider,
    { value: { role, needsRoleSelection, isProvider, isWhitelistedProvider, setRole, setNeedsRoleSelection } },
    children,
  )
}

export function useRole() {
  return useContext(RoleContext)
}

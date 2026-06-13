import { http, createConfig } from 'wagmi'
import { baseSepolia, base } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const chains = [baseSepolia, base] as const

export const config = createConfig({
  chains,
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
    [base.id]: http('https://mainnet.base.org'),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}

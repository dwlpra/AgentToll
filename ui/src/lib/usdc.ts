export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',  // Base Mainnet
}

export const USDC_DECIMALS = 6

export const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
] as const

export function getUsdcAddress(chainId: number): `0x${string}` {
  return USDC_ADDRESSES[chainId] ?? USDC_ADDRESSES[84532]
}

export function formatUsdc(raw: bigint): string {
  const value = Number(raw) / Math.pow(10, USDC_DECIMALS)
  return value.toFixed(2)
}

export function parseUsdc(usd: number): bigint {
  return BigInt(Math.round(usd * Math.pow(10, USDC_DECIMALS)))
}

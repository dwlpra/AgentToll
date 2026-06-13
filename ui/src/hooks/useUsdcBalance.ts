import { useReadContract, useAccount } from 'wagmi'
import { getUsdcAddress, ERC20_ABI, formatUsdc } from '../lib/usdc'

export function useUsdcBalance() {
  const { address, chainId } = useAccount()
  const usdcAddress = getUsdcAddress(chainId ?? 8453)

  const { data: balance, refetch } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      refetchInterval: 10000,
    },
  })

  return {
    balance: balance ? formatUsdc(balance as bigint) : '0.00',
    rawBalance: balance as bigint | undefined,
    refetch,
  }
}

/**
 * erc20.ts — ERC-20 transfer calldata encoder
 *
 * Builds the calldata (bytes) to call the transfer() function on the USDC
 * (ERC-20) smart contract.
 *
 * The 1Shot relayer requires a `data` field carrying the instruction
 * "transfer X USDC to address Y". This data is the ABI-encoded call to
 * transfer(address,uint256).
 *
 * Example output:
 *   0xa9059cbb                                  ← function selector (transfer)
 *   000000000000000000000000[recipient]         ← destination address (padded)
 *   00000000000000000000000000000000000000000000000000000000000186a0  ← amount (100000)
 */

import { encodeFunctionData } from "viem";

// Minimal ABI: only the transfer() function is needed.
const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },     // recipient address
      { name: "amount", type: "uint256" }, // amount in smallest unit (6 decimals for USDC)
    ],
    outputs: [{ name: "", type: "bool" }], // returns true on success
  },
] as const;

/**
 * Encode an ERC-20 transfer calldata.
 *
 * @param to     - Recipient address (the content provider wallet)
 * @param amount - USDC amount in smallest unit (1 USDC = 1_000_000)
 * @returns Hex-encoded calldata ready to submit to the blockchain
 *
 * Example:
 *   encodeTransfer("0xRECIPIENT...", 100000n)
 *   → "0xa9059cbb000000000000000000000000[recipient]00000000000000000000000000000000000000000000000000000000000186a0"
 */
export function encodeTransfer(to: `0x${string}`, amount: bigint): `0x${string}` {
  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [to, amount],
  });
}

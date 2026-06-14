/**
 * erc20.ts — Encoder untuk ERC-20 transfer calldata
 *
 * File ini membuat calldata (bytes) untuk memanggil fungsi transfer()
 * pada smart contract USDC (ERC-20).
 *
 * Mengapa perlu? Karena 1Shot relayer butuh `data` field yang berisi
 * instruksi "transfer X USDC ke address Y". Data ini adalah ABI-encoded
 * function call ke transfer(address,uint256).
 *
 * Contoh output:
 *   0xa9059cbb  ← function selector (transfer)
 *   000000000000000000000000fd2b...  ← address tujuan (padded)
 *   00000000000000000000000000000000000000000000000000000000000f4240  ← amount (1000000)
 */

import { encodeFunctionData } from "viem";

// Minimal ABI: hanya fungsi transfer() yang kita butuhkan
const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },    // address penerima
      { name: "amount", type: "uint256" }, // jumlah (dalam smallest unit, 6 decimals untuk USDC)
    ],
    outputs: [{ name: "", type: "bool" }], // returns true jika berhasil
  },
] as const;

/**
 * Encode ERC-20 transfer calldata.
 *
 * @param to    - Address penerima (wallet penyedia konten)
 * @param amount - Jumlah USDC dalam smallest unit (1 USDC = 1_000_000)
 * @returns Hex-encoded calldata siap kirim ke blockchain
 *
 * Contoh:
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

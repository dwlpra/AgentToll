import { config } from "../config.js";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";

export interface GrantedPermission {
  permissionsContext: string;
  sessionAccount: string;
}

export { erc7715ProviderActions };

export async function requestPermissions(
  walletClient: any,
  accountAddress: string
): Promise<GrantedPermission> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 7 * 24 * 60 * 60;

  const granted = await walletClient.requestExecutionPermissions([{
    chainId: config.chainId,
    expiry,
    signer: accountAddress,
    isAdjustmentAllowed: false,
    permission: {
      type: "erc20-token-periodic",
      data: {
        tokenAddress: config.usdcAddress,
        periodAmount: BigInt(config.budgetUnits),
        periodDuration: 24 * 60 * 60,
        startTime: now,
        justification: "Pay-per-crawl access budget",
      },
    },
  }]);

  return {
    permissionsContext: granted[0]?.permissionsContext || "",
    sessionAccount: accountAddress,
  };
}

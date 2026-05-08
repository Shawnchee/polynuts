'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { getReadClient } from './clients';

/**
 * USDC allowance from the connected wallet to a given OptionBook spender.
 * Refreshes every 15s so a fresh approval is reflected without page reload.
 *
 * Returns null while disconnected or before the first fetch resolves.
 */
export function useUsdcAllowance(spender: string | null | undefined) {
  const { address } = useAccount();
  const client = getReadClient();
  const usdc = client.chainConfig.tokens.USDC;

  return useQuery({
    queryKey: ['usdc-allowance', address, spender],
    queryFn: async () => {
      if (!address || !spender || !usdc) return 0n;
      return client.erc20.getAllowance(usdc.address, address, spender);
    },
    enabled: !!address && !!spender && !!usdc,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}

/** uint256 max — used to grant unlimited approval. */
export const MAX_UINT256 = 2n ** 256n - 1n;

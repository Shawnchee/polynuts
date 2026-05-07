'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { fromBigInt } from '@thetanuts-finance/thetanuts-client';
import { getReadClient } from './clients';

export function useUsdcBalance() {
  const { address } = useAccount();
  const client = getReadClient();
  const usdc = client.chainConfig.tokens.USDC;

  return useQuery({
    queryKey: ['usdc-balance', address],
    queryFn: async () => {
      if (!address || !usdc) return { raw: 0n, formatted: '0' };
      const raw = await client.erc20.getBalance(usdc.address, address);
      return { raw, formatted: fromBigInt(raw, usdc.decimals) };
    },
    enabled: !!address && !!usdc,
    refetchInterval: 15_000,
  });
}

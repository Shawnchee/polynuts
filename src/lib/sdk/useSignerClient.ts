'use client';

import { useMemo } from 'react';
import { ethers } from 'ethers';
import { useWalletClient } from 'wagmi';
import type { Account, Chain, Client, Transport } from 'viem';
import { ThetanutsClient } from '@thetanuts-finance/thetanuts-client';
import { createSignerClient } from './clients';

function walletClientToSigner(
  walletClient: Client<Transport, Chain, Account>
): ethers.JsonRpcSigner {
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  // viem transport supports request — wrap via Eip1193 adapter
  const provider = new ethers.BrowserProvider(transport, network);
  return new ethers.JsonRpcSigner(provider, account.address);
}

export function useSignerClient(): {
  signerClient: ThetanutsClient | null;
  signer: ethers.Signer | null;
  address: string | undefined;
} {
  const { data: walletClient } = useWalletClient();

  return useMemo(() => {
    if (!walletClient) return { signerClient: null, signer: null, address: undefined };
    try {
      const signer = walletClientToSigner(walletClient);
      const signerClient = createSignerClient(signer);
      return { signerClient, signer, address: walletClient.account.address };
    } catch {
      return { signerClient: null, signer: null, address: walletClient.account?.address };
    }
  }, [walletClient]);
}

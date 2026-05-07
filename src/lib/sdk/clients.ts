'use client';

import { ThetanutsClient } from '@thetanuts-finance/thetanuts-client';
import { ethers } from 'ethers';
import { polynutsLogger } from './logger';

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 8453);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://base-mainnet.public.blastapi.io';
const REFERRER = process.env.NEXT_PUBLIC_REFERRER_ADDRESS;

let _readClient: ThetanutsClient | null = null;

export function getReadClient(): ThetanutsClient {
  if (_readClient) return _readClient;
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  _readClient = new ThetanutsClient({
    chainId: CHAIN_ID as 8453,
    provider,
    referrer: REFERRER,
    logger: polynutsLogger,
  });
  return _readClient;
}

export function createSignerClient(signer: ethers.Signer): ThetanutsClient {
  return new ThetanutsClient({
    chainId: CHAIN_ID as 8453,
    provider: signer.provider!,
    signer,
    referrer: REFERRER,
    logger: polynutsLogger,
  });
}

export const REFERRER_ADDRESS = REFERRER;
export const POLYNUTS_CHAIN_ID = CHAIN_ID;

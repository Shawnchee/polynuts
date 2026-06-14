'use client';

import { AlertTriangle } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { POLYNUTS_CHAIN_ID } from '@/lib/sdk/clients';
import { cn } from '@/lib/utils';

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  56: 'BNB Chain',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum',
  43114: 'Avalanche',
  59144: 'Linea',
};

/**
 * Loud, hard-to-miss banner that warns the user when their wallet is on
 * the wrong chain. Polynuts trades exclusively on Base mainnet — every
 * fill / approval / read assumes chainId = 8453.
 *
 * Renders nothing when the wallet isn't connected (the Connect button
 * itself prompts chain selection via RainbowKit) or when the wallet IS
 * on Base. Otherwise: full-width red strip with X icon + Switch CTA.
 */
export function NetworkGuard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) return null;
  if (chainId === POLYNUTS_CHAIN_ID) return null;

  const currentName = CHAIN_NAMES[chainId] ?? `chain ${chainId}`;

  return (
    <div
      role="alert"
      className={cn(
        'sticky top-14 z-30 border-b border-dump',
        // High-contrast red so the user can't miss it. Same red as the
        // dump-direction colour so the visual language ("this is wrong")
        // is consistent with the rest of the app.
        'bg-dump text-white shadow-md'
      )}
    >
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className="h-5 w-5 shrink-0 rounded-full bg-white/20 p-0.5"
            aria-hidden
          />
          <span>
            <strong className="font-bold">Wrong network — your wallet is on {currentName}.</strong>
            {' '}Polynuts only works on Base mainnet. Switch networks to place a bet.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => switchChain({ chainId: POLYNUTS_CHAIN_ID })}
            disabled={isPending}
            className={cn(
              'press-scale cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-bold text-dump transition-opacity hover:opacity-90',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-dump',
              isPending && 'cursor-not-allowed opacity-60'
            )}
          >
            {isPending ? 'Switching…' : 'Switch to Base →'}
          </button>
          <ConnectButton.Custom>
            {({ openChainModal }) => (
              <button
                onClick={openChainModal}
                className="press-scale cursor-pointer rounded-md border border-white/40 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-dump"
              >
                Choose
              </button>
            )}
          </ConnectButton.Custom>
        </div>
      </div>
    </div>
  );
}

/**
 * Always-visible compact chain chip for the top nav. Green when on Base,
 * red when on the wrong chain. Click to switch / open the chain modal.
 */
export function ChainStatusChip() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected) return null;
  const onBase = chainId === POLYNUTS_CHAIN_ID;
  const name = CHAIN_NAMES[chainId] ?? `chain ${chainId}`;

  if (onBase) {
    return (
      <span
        className="hidden items-center gap-1.5 rounded-full border border-pump/40 bg-pump/10 px-2.5 py-1 text-xs font-semibold text-pump dark:text-pump-dark sm:inline-flex"
        title="Connected to Base mainnet"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-pump animate-pulse-glow" />
        Base
      </span>
    );
  }
  return (
    <button
      onClick={() => switchChain({ chainId: POLYNUTS_CHAIN_ID })}
      title={`On ${name} — click to switch to Base`}
      aria-label={`Wrong network: on ${name}. Switch to Base.`}
      className="press-scale inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-dump/50 bg-dump/15 px-2.5 py-1 text-xs font-semibold text-dump dark:text-dump-dark transition-colors hover:bg-dump/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dump/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:min-h-0"
    >
      <AlertTriangle className="h-3 w-3" aria-hidden />
      {name} → Base
    </button>
  );
}

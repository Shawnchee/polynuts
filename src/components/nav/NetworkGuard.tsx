'use client';

import { AlertTriangle } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { POLYNUTS_CHAIN_ID } from '@/lib/sdk/clients';
import { cn } from '@/lib/utils';

/**
 * Sticky top-of-page banner that warns the user when their wallet is on
 * the wrong chain. Polynuts trades exclusively on Base mainnet — every
 * fill / approval / read assumes chainId = 8453, so anything else is
 * unusable.
 *
 * Renders nothing when:
 *   - the wallet isn't connected (the Connect button itself prompts chain
 *     selection via RainbowKit)
 *   - the wallet IS on Base
 *
 * Otherwise shows a non-dismissable amber banner with a one-click
 * "Switch to Base" CTA wired to wagmi's switchChain.
 */
export function NetworkGuard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) return null;
  if (chainId === POLYNUTS_CHAIN_ID) return null;

  return (
    <div
      role="alert"
      className={cn(
        'sticky top-14 z-20 border-b border-warning/40',
        'bg-[#FEF3C7] dark:bg-[#3F2A0A] text-[#78350F] dark:text-[#FBBF24]'
      )}
    >
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">Wrong network.</strong>{' '}
            Polynuts only works on Base mainnet — switch your wallet to
            place a bet.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => switchChain({ chainId: POLYNUTS_CHAIN_ID })}
            disabled={isPending}
            className={cn(
              'press-scale rounded-md bg-warning px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90',
              isPending && 'cursor-not-allowed opacity-60'
            )}
            style={{ background: '#D97706' }}
          >
            {isPending ? 'Switching…' : 'Switch to Base'}
          </button>
          <ConnectButton.Custom>
            {({ openChainModal }) => (
              <button
                onClick={openChainModal}
                className="press-scale rounded-md border border-warning/60 px-3 py-1.5 text-xs font-medium hover:bg-warning/10"
                style={{ borderColor: '#D97706', color: 'inherit' }}
              >
                Choose network
              </button>
            )}
          </ConnectButton.Custom>
        </div>
      </div>
    </div>
  );
}

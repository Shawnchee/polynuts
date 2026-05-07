'use client';

import { useEffect, useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import {
  isThetanutsError,
  OrderExpiredError,
  InsufficientAllowanceError,
  InsufficientBalanceError,
  ContractRevertError,
  RateLimitError,
  toBigInt,
  fromBigInt,
} from '@thetanuts-finance/thetanuts-client';
import type { MarketView } from '@/lib/sdk/markets';
import { getReadClient } from '@/lib/sdk/clients';
import { useSignerClient } from '@/lib/sdk/useSignerClient';
import { useUsdcBalance } from '@/lib/sdk/useUsdcBalance';
import { DirectionTag } from '@/components/ui/DirectionTag';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';

const SIZES = [5, 10, 25, 50, 100] as const;

export function TradePanel({ market }: { market: MarketView | null }) {
  const [amount, setAmount] = useState<number>(10);
  const { isConnected } = useAccount();
  const { signerClient } = useSignerClient();
  const { data: balance } = useUsdcBalance();
  const prependActivity = useAppStore((s) => s.prependActivity);

  const [submitting, setSubmitting] = useState(false);

  const readClient = getReadClient();

  // Recompute preview when amount changes (debounced)
  const [preview, setPreview] = useState<{
    numContracts: bigint;
    pricePerContract: bigint;
    multiplier: number;
    payout: bigint;
  } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!market) {
      setPreview(null);
      return;
    }
    const id = setTimeout(() => {
      try {
        const usdcAmount = toBigInt(String(amount), 6);
        const p = readClient.optionBook.previewFillOrder(market.order, usdcAmount);
        // Approximate "win" payout for binary framing
        const m = market.multiplier;
        const payout = BigInt(Math.round(amount * m * 1_000_000));
        setPreview({
          numContracts: p.numContracts,
          pricePerContract: p.pricePerContract,
          multiplier: m,
          payout,
        });
        setPreviewError(null);
      } catch (e: unknown) {
        setPreview(null);
        setPreviewError(e instanceof Error ? e.message : 'Preview failed');
      }
    }, 300);
    return () => clearTimeout(id);
  }, [market, amount, readClient]);

  const insufficientBalance = useMemo(() => {
    if (!balance) return false;
    try {
      return Number(balance.formatted) < amount;
    } catch {
      return false;
    }
  }, [balance, amount]);

  if (!market) {
    return (
      <div className="rounded-lg border border-ink-200 bg-white p-6">
        <p className="text-sm text-ink-400">Select a market to place a bet.</p>
      </div>
    );
  }

  async function handleBet() {
    if (!market || !signerClient) {
      toast.error('Connect your wallet first');
      return;
    }
    setSubmitting(true);
    const t = toast.loading('Placing your bet…');
    try {
      const usdcAmount = toBigInt(String(amount), 6);

      // 1. Ensure allowance
      const usdcAddr = signerClient.chainConfig.tokens.USDC.address;
      const optionBook = signerClient.chainConfig.contracts.optionBook;
      if (!optionBook) throw new Error('OptionBook not deployed on this chain');
      await signerClient.erc20.ensureAllowance(usdcAddr, optionBook, usdcAmount);

      // 2. Fill
      const receipt = await signerClient.optionBook.fillOrder(market.order, usdcAmount);

      const explorer = signerClient.chainConfig.explorerUrl;
      const txHash =
        (receipt as unknown as { hash?: string })?.hash ??
        (receipt as unknown as { transactionHash?: string })?.transactionHash;
      const url = txHash ? `${explorer}/tx/${txHash}` : explorer;

      toast.success(
        <span>
          Bet placed!{' '}
          <a
            className="text-brand underline"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            View on Basescan
          </a>
        </span>,
        { id: t, duration: 8000 }
      );

      prependActivity({
        id: `${market.id}-${Date.now()}`,
        ts: Date.now(),
        kind: 'filled',
        asset: market.asset,
        direction: market.direction,
        question: `${market.direction} · $${amount}`,
      });
    } catch (err: unknown) {
      let msg = 'Transaction failed';
      if (err instanceof OrderExpiredError) msg = 'Market closed — pick a fresh one';
      else if (err instanceof InsufficientAllowanceError) msg = 'Approval needed — try again';
      else if (err instanceof InsufficientBalanceError) msg = 'Insufficient USDC balance';
      else if (err instanceof RateLimitError) msg = 'Rate limited — try again in a moment';
      else if (err instanceof ContractRevertError) msg = `Contract reverted: ${err.message}`;
      else if (isThetanutsError(err)) msg = err.message;
      else if (err instanceof Error && /user rejected/i.test(err.message)) msg = 'Cancelled';
      else if (err instanceof Error) msg = err.message;
      toast.error(msg, { id: t });
    } finally {
      setSubmitting(false);
    }
  }

  const dirCls =
    market.direction === 'PUMP'
      ? 'bg-pump hover:bg-pump/90'
      : market.direction === 'DUMP'
      ? 'bg-dump hover:bg-dump/90'
      : 'bg-range hover:bg-range/90';

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold text-ink-900">Place Your Bet</h3>
        <DirectionTag direction={market.direction} />
      </div>

      <p className="mt-3 text-base font-medium leading-snug text-ink-900">
        {market.question}
      </p>

      <div className="mt-4">
        <div className="label text-ink-400">Amount</div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setAmount(s)}
              className={cn(
                'rounded-md border px-1 py-2 text-sm font-medium transition-colors num tabular-nums',
                amount === s
                  ? 'border-ink-900 bg-ink-900 text-white'
                  : 'border-ink-200 text-ink-900 hover:border-ink-400'
              )}
            >
              ${s}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="label text-ink-400">Custom</span>
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
            className="w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 num text-sm tabular-nums text-ink-900 focus:border-brand"
          />
        </div>
      </div>

      <div className="mt-4 rounded-md bg-ink-100 p-3 space-y-1.5">
        <SummaryRow label="You bet" value={`$${amount} USDC`} />
        <SummaryRow
          label="Contracts"
          value={
            preview
              ? Number(fromBigInt(preview.numContracts, 6)).toLocaleString('en-US', {
                  maximumFractionDigits: 4,
                })
              : '—'
          }
        />
        <SummaryRow
          label="If correct"
          value={
            preview
              ? `+$${Number(fromBigInt(preview.payout, 6)).toLocaleString('en-US', {
                  maximumFractionDigits: 2,
                })}`
              : '—'
          }
          highlight
        />
        <SummaryRow
          label="Return"
          value={preview ? `${preview.multiplier.toFixed(2)}x` : '—'}
        />
        <SummaryRow label="Structure" value={market.structureName} />
        <SummaryRow
          label="Settles"
          value={new Date(market.expiry * 1000).toUTCString().slice(17, 22) + ' UTC'}
        />
      </div>

      {previewError && (
        <p className="mt-2 text-sm text-dump">{previewError}</p>
      )}

      <div className="mt-4">
        {!isConnected ? (
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button
                onClick={openConnectModal}
                className="w-full rounded-md bg-brand py-3 text-base font-semibold text-white transition-transform hover:bg-brand-dark active:scale-[0.98]"
              >
                Connect Wallet to Bet
              </button>
            )}
          </ConnectButton.Custom>
        ) : (
          <button
            onClick={handleBet}
            disabled={submitting || insufficientBalance || !preview}
            className={cn(
              'w-full rounded-md py-3 text-base font-semibold text-white transition-all active:scale-[0.98]',
              dirCls,
              (submitting || insufficientBalance || !preview) && 'cursor-not-allowed opacity-60'
            )}
          >
            {submitting
              ? 'Placing bet…'
              : insufficientBalance
              ? 'Insufficient USDC'
              : `Bet ${market.direction} — $${amount} USDC`}
          </button>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-ink-400">
        Powered by Thetanuts V4
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-600">{label}</span>
      <span
        className={cn(
          'num tabular-nums font-medium',
          highlight ? 'text-pump font-bold' : 'text-ink-900'
        )}
      >
        {value}
      </span>
    </div>
  );
}

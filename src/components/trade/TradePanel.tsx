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
  SlippageExceededError,
  SignerRequiredError,
  NetworkUnsupportedError,
  InvalidParamsError,
  toBigInt,
  fromBigInt,
  validateOrderExpiry,
} from '@thetanuts-finance/thetanuts-client';
import type { MarketView } from '@/lib/sdk/markets';
import { getReadClient } from '@/lib/sdk/clients';
import { useSignerClient } from '@/lib/sdk/useSignerClient';
import { useUsdcBalance } from '@/lib/sdk/useUsdcBalance';
import { useFillPayout, useMarketBinaryFraming } from '@/lib/sdk/usePayout';
import { DirectionTag } from '@/components/ui/DirectionTag';
import { ShareWinCard } from '@/components/share/ShareWinCard';
import { PayoutVisualizer } from '@/components/trade/PayoutVisualizer';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';

// Size presets — $1 / $5 / $10 / $25 / $100. The custom input below
// accepts any value as the user types and validates >= MIN_BET only
// at submit, so partial input ("1.", "0.") doesn't get clobbered.
const SIZES = [1, 5, 10, 25, 100] as const;
const MIN_BET = 1;

interface PreviewState {
  numContracts: bigint;
  /** Maximum contracts the maker has signed for — caps user's bet */
  maxContracts: bigint;
  pricePerContract: bigint;
  /** Same currency as `numContracts × pricePerContract / 1e8`, in 6-dec USDC */
  totalCollateral: bigint;
  /** True when usdcAmount would have exceeded the cap and was clamped */
  capped: boolean;
}

export function TradePanel({ market }: { market: MarketView | null }) {
  // Default bet size $1 — small enough that anyone can test the full
  // approve + fill flow without committing real money.
  // Track the input as a string so partial values ("1.", "10.5") don't
  // get clobbered to a number on every keystroke; parse + validate at
  // submit time only.
  const [amountInput, setAmountInput] = useState<string>('1');
  const amount = useMemo(() => {
    const n = Number(amountInput);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amountInput]);
  const { isConnected } = useAccount();
  const { signerClient, ready, notReadyReason } = useSignerClient();
  const { data: balance } = useUsdcBalance();
  const prependActivity = useAppStore((s) => s.prependActivity);
  const [submitting, setSubmitting] = useState(false);

  const readClient = getReadClient();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // SDK-driven max payout for the binary framing (multiplier + implied odds)
  const { data: binary } = useMarketBinaryFraming(market);
  // SDK-driven realised payout for the actual numContracts being purchased.
  // Calls client.option.simulatePayout under the hood — this is the exact
  // amount the contract would pay out at the structural maximum, no
  // homegrown decimal scaling.
  const { data: payoutAtFill } = useFillPayout(market, preview?.numContracts ?? null);

  useEffect(() => {
    if (!market) {
      setPreview(null);
      return;
    }
    const id = setTimeout(() => {
      try {
        const usdcAmount = toBigInt(String(amount), 6);
        const p = readClient.optionBook.previewFillOrder(market.order, usdcAmount);
        // The SDK silently caps numContracts at maxContracts when usdcAmount
        // exceeds the maker's available size — surface that to the user
        // instead of letting them think their full bet went on.
        const capped = p.numContracts >= p.maxContracts && p.maxContracts > 0n;
        setPreview({
          numContracts: p.numContracts,
          maxContracts: p.maxContracts,
          pricePerContract: p.pricePerContract,
          totalCollateral: p.totalCollateral,
          capped,
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
      <div className="rounded-xl border border-line bg-bg-elev p-6 animate-fade-in">
        <p className="text-sm text-text-dim">Select a market to place a bet.</p>
      </div>
    );
  }

  async function handleBet() {
    if (!market) return;
    if (!ready || !signerClient) {
      // Surface the actual blocker rather than a generic "connect wallet"
      // message — wrong-chain is by far the most common cause of "click
      // and nothing happens" because viem's connector client is null
      // when on a non-configured chain.
      if (notReadyReason === 'wrong-chain') {
        toast.error('Switch your wallet to Base mainnet to bet');
      } else if (notReadyReason === 'adapter-failed') {
        toast.error('Wallet bridge failed — try reconnecting');
      } else {
        toast.error('Connect your wallet first');
      }
      return;
    }
    if (amount < MIN_BET) {
      toast.error(`Minimum bet is $${MIN_BET} USDC`);
      return;
    }
    setSubmitting(true);
    const t = toast.loading('Placing your bet…');
    // eslint-disable-next-line no-console
    console.info('[polynuts] handleBet start', {
      market: market.id,
      amount,
      direction: market.direction,
    });
    try {
      // Pre-fill expiry guard — fails fast before sending the user through
      // wallet approval if the order has already expired (SDK throws inside
      // fillOrder otherwise, after the user has signed).
      validateOrderExpiry(Number(market.order.order.expiry));

      const usdcAmount = toBigInt(String(amount), 6);
      const usdcAddr = signerClient.chainConfig.tokens.USDC.address;
      // Approve and fill against the SAME OptionBook instance the order was
      // signed for. Odette's order can be tied to a non-default OptionBook
      // via `rawApiData.optionBookAddress` — the SDK's fillOrder uses that
      // override (optionBook.ts:417), so the approval must target it too.
      const orderOptionBook =
        market.order.rawApiData?.optionBookAddress ??
        signerClient.chainConfig.contracts.optionBook;
      if (!orderOptionBook) throw new Error('OptionBook not deployed on this chain');

      // eslint-disable-next-line no-console
      console.info('[polynuts] ensureAllowance', { usdcAddr, orderOptionBook, usdcAmount });
      const approveReceipt = await signerClient.erc20.ensureAllowance(
        usdcAddr,
        orderOptionBook,
        usdcAmount
      );
      // eslint-disable-next-line no-console
      console.info('[polynuts] approval done', { txHash: approveReceipt?.hash ?? 'already-approved' });
      // eslint-disable-next-line no-console
      console.info('[polynuts] fillOrder start');
      const receipt = await signerClient.optionBook.fillOrder(market.order, usdcAmount);
      // eslint-disable-next-line no-console
      console.info('[polynuts] fillOrder done', { txHash: receipt?.hash });

      const explorer = signerClient.chainConfig.explorerUrl;
      // ethers v6 TransactionReceipt → .hash (no v5 .transactionHash fallback needed)
      const txHash = receipt?.hash;
      const url = txHash ? `${explorer}/tx/${txHash}` : explorer;

      // Build the share-card args from the SDK-derived numbers we have.
      // payoutAtFill comes from useFillPayout (client.option.simulatePayout) —
      // it's the max payout in 6-dec USDC. Fall back to amount × multiplier
      // when binary framing is unavailable (vanilla case).
      const shareArgs = market
        ? {
            result: 'pending' as const,
            bet: amount,
            payout:
              payoutAtFill != null
                ? Number(readClient.utils.fromUsdcDecimals(payoutAtFill))
                : binary?.multiplier
                ? Math.round(amount * binary.multiplier)
                : amount,
            direction: market.direction,
            question: market.question,
            asset: market.asset,
          }
        : null;

      toast.success(
        <div className="flex flex-col gap-2">
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
          </span>
          {shareArgs && shareArgs.payout > shareArgs.bet && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-text-muted">Brag a little —</span>
              <ShareWinCard args={shareArgs} size="sm" />
            </div>
          )}
        </div>,
        { id: t, duration: 12_000 }
      );

      prependActivity({
        id: `${market.id}-${Date.now()}`,
        ts: Date.now(),
        kind: 'filled',
        asset: market.asset,
        direction: market.direction,
        question: `${market.direction} · $${amount} · ${market.asset}`,
      });
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error('[polynuts] handleBet error', err);
      // Map every typed SDK error class to a friendly message. The PRD §8
      // error-code table is the source for what each maps to.
      let msg = 'Transaction failed';
      if (err instanceof OrderExpiredError) msg = 'Market closed — pick a fresh one';
      else if (err instanceof InsufficientAllowanceError) msg = 'Approval needed — try again';
      else if (err instanceof InsufficientBalanceError) msg = 'Insufficient USDC balance';
      else if (err instanceof SlippageExceededError) msg = 'Price moved, try again';
      else if (err instanceof RateLimitError) msg = 'Rate limited — try again in a moment';
      else if (err instanceof NetworkUnsupportedError) msg = 'Please switch to Base';
      else if (err instanceof SignerRequiredError) msg = 'Connect your wallet';
      else if (err instanceof InvalidParamsError) msg = 'Invalid input — try again';
      else if (err instanceof ContractRevertError) msg = `Contract reverted: ${err.message}`;
      else if (isThetanutsError(err)) msg = err.message;
      else if (err instanceof Error && /user rejected|user denied/i.test(err.message)) msg = 'Cancelled';
      else if (err instanceof Error) msg = err.message;
      toast.error(msg, { id: t });
    } finally {
      setSubmitting(false);
    }
  }

  const dirCls =
    market.direction === 'PUMP'
      ? 'bg-pump hover:bg-pump/90 glow-pump'
      : market.direction === 'DUMP'
      ? 'bg-dump hover:bg-dump/90 glow-dump'
      : 'bg-range hover:bg-range/90 glow-range';

  // simulatePayout returns 6-dec USDC; use SDK's formatAmount for the
  // canonical "trim to N display digits" formatting.
  const payoutUsdcStr = payoutAtFill
    ? `+$${Number(readClient.utils.formatAmount(payoutAtFill, 6, 2)).toLocaleString(
        'en-US',
        { maximumFractionDigits: 2 }
      )}`
    : null;
  const isVanilla = market.family === 'vanilla';

  return (
    <div className="rounded-xl border border-line bg-bg-elev p-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold text-text">Place Your Bet</h3>
        <DirectionTag direction={market.direction} />
      </div>

      <p className="mt-3 text-base font-medium leading-snug text-text">{market.question}</p>

      <div className="mt-4">
        <div className="label text-text-dim">Amount</div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setAmountInput(String(s))}
              className={cn(
                'press-scale rounded-md border px-1 py-2 text-sm font-medium tabular-nums num transition-colors duration-120',
                amount === s
                  ? 'border-text bg-text text-bg-elev'
                  : 'border-line text-text hover:border-text-dim hover:bg-surface-hover'
              )}
            >
              ${s}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="label text-text-dim">Custom</span>
          <input
            // Free-form text input — accepts any partial value while typing
            // ("1.", "10.5", "") so the cursor never jumps. Validation runs
            // at submit time against MIN_BET.
            type="text"
            inputMode="decimal"
            placeholder={`min $${MIN_BET}`}
            value={amountInput}
            onChange={(e) => {
              // Permit only digits + a single dot — strip everything else
              const cleaned = e.target.value.replace(/[^0-9.]/g, '');
              const dotCount = (cleaned.match(/\./g) ?? []).length;
              if (dotCount > 1) return;
              setAmountInput(cleaned);
            }}
            className="w-full rounded-md border border-line bg-surface px-2 py-1.5 num text-sm tabular-nums text-text focus:border-brand"
          />
        </div>
        {amountInput !== '' && amount > 0 && amount < MIN_BET && (
          <p className="mt-1 text-xs text-dump dark:text-dump-dark">
            Minimum bet is ${MIN_BET} USDC
          </p>
        )}
      </div>

      <div className="mt-4 space-y-1.5 rounded-md border border-line bg-bg-subtle p-3">
        <SummaryRow label="You bet" value={`$${amount} USDC`} />
        <SummaryRow
          label="Contracts"
          value={
            preview
              ? Number(
                  readClient.utils.formatAmount(preview.numContracts, 6, 4)
                ).toLocaleString('en-US', { maximumFractionDigits: 4 })
              : '—'
          }
        />
        {!isVanilla ? (
          <>
            <SummaryRow
              label="If correct"
              value={payoutUsdcStr ?? '…'}
              highlight={!!payoutUsdcStr}
            />
            <SummaryRow
              label="Return"
              value={binary?.multiplier ? `${binary.multiplier.toFixed(2)}x` : '…'}
            />
          </>
        ) : (
          <SummaryRow label="Payoff" value="open-ended (vanilla option)" mono={false} />
        )}
        <SummaryRow label="Structure" value={market.structureName} mono={false} />
        <SummaryRow
          label="Settles"
          value={new Date(market.expiry * 1000).toUTCString().slice(17, 22) + ' UTC'}
        />
      </div>

      {previewError && <p className="mt-2 text-sm text-dump">{previewError}</p>}

      {preview && (
        <div className="mt-3">
          <PayoutVisualizer market={market} numContracts={preview.numContracts} />
        </div>
      )}

      {preview?.capped && (
        <p className="mt-2 text-xs text-text-muted">
          Maker cap reached — this order can absorb at most{' '}
          <span className="num font-semibold text-text">
            $
            {Number(
              readClient.utils.formatAmount(preview.totalCollateral, 6, 0)
            ).toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
          . Larger amount sizes fill against the cap.
        </p>
      )}

      <div className="mt-4">
        {!isConnected ? (
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button
                onClick={openConnectModal}
                className="press-scale w-full rounded-md bg-brand py-3 text-base font-semibold text-white transition-colors hover:bg-brand-dark glow-brand"
              >
                Connect Wallet to Bet
              </button>
            )}
          </ConnectButton.Custom>
        ) : notReadyReason === 'wrong-chain' ? (
          <ConnectButton.Custom>
            {({ openChainModal }) => (
              <button
                onClick={openChainModal}
                className="press-scale w-full rounded-md bg-warning py-3 text-base font-semibold text-white transition-colors hover:opacity-90"
                style={{ background: '#D97706' }}
              >
                Switch to Base to Bet
              </button>
            )}
          </ConnectButton.Custom>
        ) : (
          <button
            onClick={handleBet}
            disabled={
              submitting ||
              insufficientBalance ||
              !preview ||
              amount < MIN_BET ||
              !ready
            }
            className={cn(
              'press-scale w-full rounded-md py-3 text-base font-semibold text-white transition-colors',
              dirCls,
              (submitting || insufficientBalance || !preview || amount < MIN_BET || !ready) &&
                'cursor-not-allowed opacity-60'
            )}
          >
            {submitting
              ? 'Placing bet…'
              : insufficientBalance
              ? 'Insufficient USDC'
              : amount < MIN_BET
              ? `Min $${MIN_BET}`
              : `Bet ${market.direction} — $${amount} USDC`}
          </button>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-text-dim">Powered by Thetanuts V4</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
  mono = true,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-muted">{label}</span>
      <span
        className={cn(
          'font-medium',
          mono && 'num tabular-nums',
          highlight ? 'text-pump font-bold' : 'text-text'
        )}
      >
        {value}
      </span>
    </div>
  );
}

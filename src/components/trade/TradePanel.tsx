'use client';

import { useEffect, useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import {
  isThetanutsError,
  OPTION_BOOK_ABI,
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
import { useUsdcAllowance, MAX_UINT256 } from '@/lib/sdk/useUsdcAllowance';
import { DirectionTag } from '@/components/ui/DirectionTag';
import { PayoutChart } from '@/components/trade/PayoutChart';
import { TradingViewChart } from '@/components/trade/TradingViewChart';
import {
  ConfirmTradeModal,
  type PendingTrade,
} from '@/components/trade/ConfirmTradeModal';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Loader2 } from 'lucide-react';

type ChartTab = 'payout' | 'spot';

// Size presets — $1 / $5 / $10 / $25 / $100. The custom input below
// accepts any value as the user types and validates >= MIN_BET only
// at submit, so partial input ("1.", "0.") doesn't get clobbered.
const SIZES = [1, 5, 10, 25, 100] as const;
const MIN_BET = 0.5;

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

export function TradePanel({
  market,
  isLoading = false,
}: {
  market: MarketView | null;
  isLoading?: boolean;
}) {
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
  const { isConnected, address } = useAccount();
  const { signerClient, signer, ready, notReadyReason } = useSignerClient();
  const { data: balance } = useUsdcBalance();
  const prependActivity = useAppStore((s) => s.prependActivity);
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  // Staged trade waiting for explicit user confirm via the 10s modal.
  // Set by handleBet, cleared by the modal's cancel or after fill.
  const [pendingTrade, setPendingTrade] = useState<PendingTrade | null>(null);

  // Check the current USDC allowance against the order's OptionBook spender.
  // When allowance < bet, we surface a separate "Approve USDC" button so
  // the user does the approval explicitly first (instead of two wallet
  // popups inside one click). Approving max-uint256 means future bets up
  // to that allowance fire fillOrder directly with no second wallet popup.
  const orderOptionBook =
    market?.order.rawApiData?.optionBookAddress ??
    signerClient?.chainConfig.contracts.optionBook ??
    null;
  const { data: allowance } = useUsdcAllowance(orderOptionBook);

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

  // Whether the wallet has enough USDC pre-approved to skip the approval
  // step. Compares allowance bigint to the bet's USDC amount in 6-dec.
  const needsApproval = useMemo(() => {
    if (!allowance) return true;
    try {
      const required = toBigInt(String(amount), 6);
      return allowance < required;
    } catch {
      return true;
    }
  }, [allowance, amount]);

  async function handleApprove() {
    if (!ready || !signerClient || !signer || !orderOptionBook) {
      if (notReadyReason === 'wrong-chain') {
        toast.error('Switch your wallet to Base mainnet first');
      } else {
        toast.error('Connect your wallet first');
      }
      return;
    }
    setApproving(true);
    const t = toast.loading('Sign the approval in your wallet…');
    // eslint-disable-next-line no-console
    console.info('[polynuts] approve start', {
      usdc: signerClient.chainConfig.tokens.USDC.address,
      spender: orderOptionBook,
      amount: 'MAX_UINT256',
    });
    try {
      const usdcAddr = signerClient.chainConfig.tokens.USDC.address;
      // Approve max — single approval covers all future bets. Standard DeFi
      // pattern; users can revoke at revoke.cash if they ever want to.
      //
      // We bypass the SDK's `signerClient.erc20.approve(...)` (which doesn't
      // expose tx overrides) and build the call directly through ethers so
      // we can pin `gasLimit`. ERC20 approve is deterministic ~46k gas.
      // Hardcoding 80k means the wallet does NOT need to call
      // `eth_estimateGas` against its own RPC before opening the popup —
      // which is the main reason the approve popup spins forever for users
      // whose wallet is configured with a slow / rate-limited public Base
      // RPC. The wallet sees a fully-formed tx and can render Confirm/Reject
      // immediately.
      const erc20 = new ethers.Interface([
        'function approve(address spender, uint256 value)',
      ]);
      const data = erc20.encodeFunctionData('approve', [
        orderOptionBook,
        MAX_UINT256,
      ]);
      const tx = await signer.sendTransaction({
        to: usdcAddr,
        data,
        gasLimit: 80_000n,
      });
      const receipt = await tx.wait();
      // eslint-disable-next-line no-console
      console.info('[polynuts] approve mined', { txHash: receipt?.hash });
      // Bust the allowance cache so the bet button activates immediately.
      await queryClient.invalidateQueries({ queryKey: ['usdc-allowance'] });
      const explorer = signerClient.chainConfig.explorerUrl;
      toast.success(
        <span>
          USDC approved! You can bet without re-approving.{' '}
          {receipt?.hash && (
            <a
              className="text-brand underline"
              href={`${explorer}/tx/${receipt.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View tx
            </a>
          )}
        </span>,
        { id: t, duration: 6000 }
      );
    } catch (err: unknown) {
      const msgText = err instanceof Error ? err.message : '';
      const wasRejection =
        /user rejected|user denied|action_rejected/i.test(msgText) ||
        (err as { code?: number }).code === 4001;
      if (wasRejection) {
        // Not an error — the user explicitly clicked Reject in their
        // wallet. Don't shout in the console; show a friendly toast
        // explaining they're free to try again.
        // eslint-disable-next-line no-console
        console.info('[polynuts] approve cancelled by user');
        toast.info(
          'You rejected the approval. Click "Approve USDC" again to retry.',
          { id: t, duration: 6000 }
        );
        return;
      }
      // Real error — log + toast.
      // eslint-disable-next-line no-console
      console.error('[polynuts] approve error', err);
      let msg = 'Approval failed';
      if (/insufficient funds/i.test(msgText)) msg = 'Insufficient ETH for gas';
      else if (msgText) msg = msgText;
      toast.error(msg, { id: t });
    } finally {
      setApproving(false);
    }
  }

  if (!market) {
    if (isLoading) {
      return <TradePanelSkeleton />;
    }
    return (
      <div className="rounded-xl border border-line bg-bg-elev p-4 animate-fade-in">
        <p className="text-sm text-text-dim">Select a market to place a bet.</p>
      </div>
    );
  }

  function handleBet() {
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
      toast.error(`Minimum bet is $${MIN_BET.toFixed(2)} USDC`);
      return;
    }
    if (!preview) {
      toast.error('Still computing your fill — try again in a moment');
      return;
    }
    // Pre-fill expiry guard — fail fast before opening the confirm modal
    // so the user isn't asked to confirm a trade we already know will
    // revert. The SDK throws inside fillOrder otherwise, after the user
    // has signed.
    try {
      validateOrderExpiry(Number(market.order.order.expiry));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Order expired';
      toast.error(msg);
      return;
    }
    // Resolve the OptionBook spender ONCE at stage time so both the
    // approval (already happened or coming via ensureAllowance) and the
    // fillOrder hit the same address. Odette can pin an order to a
    // non-default OptionBook via rawApiData.optionBookAddress.
    const spender =
      market.order.rawApiData?.optionBookAddress ??
      signerClient.chainConfig.contracts.optionBook;
    if (!spender) {
      toast.error('OptionBook not deployed on this chain');
      return;
    }
    setPendingTrade({
      market,
      amount,
      numContracts: preview.numContracts,
      totalCollateral: preview.totalCollateral,
      maxPayoutAtFill: payoutAtFill ?? null,
      optionBookSpender: spender,
    });
  }

  async function confirmAndFillBet(slippageWarning: string | null) {
    const trade = pendingTrade;
    setPendingTrade(null);
    if (!trade) return;
    if (!ready || !signerClient) {
      toast.error('Wallet not ready');
      return;
    }
    if (slippageWarning) toast.info(slippageWarning, { duration: 5000 });

    setSubmitting(true);
    const t = toast.loading('Placing your bet…');
    // eslint-disable-next-line no-console
    console.info('[polynuts] confirmAndFillBet start', {
      market: trade.market.id,
      amount: trade.amount,
      direction: trade.market.direction,
    });
    try {
      const usdcAmount = toBigInt(String(trade.amount), 6);
      const usdcAddr = signerClient.chainConfig.tokens.USDC.address;
      // Snapshot the spender from PendingTrade — resolved once at stage
      // time so the approval and fill always target the same OptionBook,
      // even if rawApiData mutates between the modal opening and confirm.
      const orderOptionBook = trade.optionBookSpender;

      // ensureAllowance is idempotent — returns null when the existing
      // allowance already covers usdcAmount, so users who pre-approved
      // via the explicit "Approve USDC" button don't see a second wallet
      // popup here.
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
      const receipt = await signerClient.optionBook.fillOrder(
        trade.market.order,
        usdcAmount
      );
      // eslint-disable-next-line no-console
      console.info('[polynuts] fillOrder done', { txHash: receipt?.hash });

      // Write this trade to Supabase immediately so it appears in the
      // activity/leaderboard without waiting for an indexer sync.
      // Fire-and-forget — never block the success UX on this.
      if (receipt?.hash && address) {
        try {
          // Parse the OrderFilled event from the receipt to get the deployed
          // option contract address (not available in the order's rawApiData).
          const iface = new ethers.Interface(OPTION_BOOK_ABI as ethers.InterfaceAbi);
          let optionId: string | null = null;
          for (const log of receipt.logs ?? []) {
            try {
              const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
              if (parsed?.name === 'OrderFilled') {
                // OrderFilled args: (nonce, buyer, seller, optionAddress, ...)
                optionId = parsed.args[3] as string;
                break;
              }
            } catch { /* skip non-matching logs */ }
          }

          if (optionId) {
            const label = `${trade.market.asset} ${trade.market.strikes
              .map((s) => `$${s.toLocaleString('en-US', { maximumFractionDigits: 0 })}`)
              .join(' / ')}`;
            const payload = {
              tx_hash: receipt.hash,
              option_id: optionId.toLowerCase(),
              taker_address: address.toLowerCase(),
              market_label: label,
              side: trade.market.direction,
              contracts: Number(fromBigInt(trade.numContracts, 6)),
              notional_usdc: trade.amount,
              entry_price: Number(fromBigInt(trade.market.pricePerContract, 8)),
              created_at: new Date().toISOString(),
            };
            fetch('/api/me/trades', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }).catch((err) => {
              // eslint-disable-next-line no-console
              console.warn('[polynuts] write-on-fill failed (non-critical)', err);
            });
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[polynuts] receipt parse failed (non-critical)', err);
        }
      }

      const explorer = signerClient.chainConfig.explorerUrl;
      const txHash = receipt?.hash;
      const url = txHash ? `${explorer}/tx/${txHash}` : explorer;

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
        </div>,
        { id: t, duration: 12_000 }
      );

      prependActivity({
        id: `${trade.market.id}-${Date.now()}`,
        ts: Date.now(),
        kind: 'filled',
        asset: trade.market.asset,
        direction: trade.market.direction,
        question: `${trade.market.direction} · $${trade.amount} · ${trade.market.asset}`,
      });

      // Invalidate the portfolio/history caches so /portfolio reflects the
      // fresh position immediately. Without this the user sees stale data
      // for up to refetchInterval (30s positions / 60s history). Indexer
      // ingestion is usually <1s after the tx mines on Base.
      const key = address?.toLowerCase();
      if (key) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['positions', key] }),
          queryClient.invalidateQueries({ queryKey: ['tradeHistory', key] }),
        ]);
      }
    } catch (err: unknown) {
      const msgText = err instanceof Error ? err.message : '';
      const wasRejection =
        /user rejected|user denied|action_rejected/i.test(msgText) ||
        (err as { code?: number }).code === 4001;
      if (wasRejection) {
        // eslint-disable-next-line no-console
        console.info('[polynuts] bet cancelled by user');
        toast.info('You rejected the bet. Click again to retry.', {
          id: t,
          duration: 5000,
        });
        return;
      }
      // eslint-disable-next-line no-console
      console.error('[polynuts] confirmAndFillBet error', err);
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
  // Show a pulse while we have a valid bet but the SDK payout call is
  // still in flight. Avoids the brief "$—" flash that looks like an error.
  const payoutLoading =
    !isVanilla && !payoutUsdcStr && amount >= MIN_BET && !!preview;

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
                'press-scale min-h-[44px] rounded-md border px-1 py-2 text-sm font-medium tabular-nums num transition-colors duration-120 sm:min-h-0',
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
            placeholder={`min $${MIN_BET.toFixed(2)}`}
            value={amountInput}
            onChange={(e) => {
              // Permit only digits + a single dot — strip everything else
              const cleaned = e.target.value.replace(/[^0-9.]/g, '');
              const dotCount = (cleaned.match(/\./g) ?? []).length;
              if (dotCount > 1) return;
              setAmountInput(cleaned);
            }}
            className="min-h-[44px] w-full rounded-md border border-line bg-surface px-2 py-1.5 num text-sm tabular-nums text-text focus:border-brand sm:min-h-0"
          />
        </div>
        {amountInput !== '' && amount > 0 && amount < MIN_BET && (
          <p className="mt-1 text-xs text-dump dark:text-dump-dark">
            Minimum bet is ${MIN_BET.toFixed(2)} USDC
          </p>
        )}
      </div>

      {/* Hero payout — the single most important number on the panel.
          Big, green, prominent. The user's "if I bet $X what do I win?"
          mental model gets a direct answer here without scanning a list. */}
      <div className="mt-4">
        {!isVanilla ? (
          <div
            className={cn(
              'relative overflow-hidden rounded-lg border p-4 text-center transition-colors duration-180',
              payoutUsdcStr
                ? 'border-pump/40 bg-pump/5 dark:bg-pump/10'
                : 'border-line bg-bg-subtle'
            )}
          >
            <div className="label text-text-dim">If correct, you win</div>
            {payoutLoading ? (
              <div
                aria-label="Calculating payout"
                className="mx-auto mt-1.5 h-7 w-32 animate-pulse rounded bg-surface-hover"
              />
            ) : (
              <div
                className={cn(
                  'num mt-1 text-2xl font-bold tabular-nums tracking-tight',
                  payoutUsdcStr ? 'text-pump dark:text-pump-dark' : 'text-text-dim'
                )}
              >
                {payoutUsdcStr ?? '$—'}
              </div>
            )}
            {binary?.multiplier && Number.isFinite(binary.multiplier) ? (
              <div className="num mt-1 text-xs font-semibold tabular-nums text-text-muted">
                {binary.multiplier.toFixed(2)}x return ·{' '}
                {Number.isFinite(binary.yesProbability)
                  ? Math.round(binary.yesProbability * 100)
                  : '—'}
                % implied probability
              </div>
            ) : payoutLoading ? (
              <div
                aria-hidden
                className="mx-auto mt-1.5 h-3 w-44 animate-pulse rounded bg-surface-hover"
              />
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-line bg-bg-subtle p-4 text-center">
            <div className="label text-text-dim">Vanilla option</div>
            <div className="num mt-1 text-base font-semibold text-text">
              Open-ended payoff
            </div>
            <div className="mt-1 text-xs text-text-muted">
              See the chart below for settlement-conditional P/L
            </div>
          </div>
        )}
      </div>

      {/* Collapsed details — progressive disclosure. The user already
          sees direction, question, amount, payout. The structure +
          contract count + settlement time are tertiary info, hidden
          behind a toggle so the primary path stays clean. */}
      <details className="mt-3 rounded-md border border-line bg-bg-subtle group">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium text-text-muted hover:text-text">
          <span>Trade details</span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-1.5 border-t border-line px-3 py-2">
          <SummaryRow
            label="You bet"
            value={amount > 0 ? `$${amount.toFixed(2)} USDC` : '—'}
          />
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
          <SummaryRow
            label="Max loss"
            value={amount > 0 ? `$${amount.toFixed(2)} USDC` : '—'}
          />
          <SummaryRow label="Structure" value={market.structureName} mono={false} />
          <SummaryRow
            label="Settles"
            value={new Date(market.expiry * 1000).toUTCString().slice(17, 22) + ' UTC'}
            mono={false}
          />
        </div>
      </details>

      {previewError && <p className="mt-2 text-sm text-dump">{previewError}</p>}

      <div className="mt-3">
        <ChartSwitcher market={market} preview={preview} amount={amount} />
      </div>

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
                className="press-scale w-full rounded-md bg-warning py-3 text-base font-semibold text-white transition-colors hover:bg-warning/90"
              >
                Switch to Base to Bet
              </button>
            )}
          </ConnectButton.Custom>
        ) : needsApproval && !insufficientBalance && amount >= MIN_BET ? (
          // Pre-approval step — separated from the bet flow so the user
          // does this once per token-spender pair (max-uint256 approval),
          // and every subsequent bet is a single wallet popup.
          <button
            onClick={handleApprove}
            disabled={approving}
            aria-busy={approving}
            className={cn(
              'press-scale flex w-full items-center justify-center gap-2 rounded-md bg-brand py-3 text-base font-semibold text-white hover:bg-brand-dark transition-colors glow-brand',
              approving && 'cursor-not-allowed opacity-60'
            )}
          >
            {approving && (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            )}
            {approving ? 'Approving…' : '1. Approve USDC for trading'}
          </button>
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
            aria-busy={submitting}
            className={cn(
              'press-scale flex w-full items-center justify-center gap-2 rounded-md py-3 text-base font-semibold text-white transition-colors',
              dirCls,
              (submitting || insufficientBalance || !preview || amount < MIN_BET || !ready) &&
                'cursor-not-allowed opacity-60'
            )}
          >
            {submitting && (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            )}
            {submitting
              ? 'Placing bet…'
              : insufficientBalance
              ? 'Insufficient USDC'
              : amount < MIN_BET
              ? `Min $${MIN_BET.toFixed(2)}`
              : !preview
              ? 'Calculating fill…'
              : `Bet ${market.direction} — $${amount.toFixed(2)} USDC`}
          </button>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-text-dim">Powered by Thetanuts V4</p>

      {pendingTrade && (
        <ConfirmTradeModal
          pending={pendingTrade}
          onConfirm={(warning) => {
            void confirmAndFillBet(warning);
          }}
          onCancel={() => setPendingTrade(null)}
        />
      )}
    </div>
  );
}

/**
 * Tab switcher for the chart slot below the summary — Payout P/L curve
 * (default) vs TradingView spot chart for the underlying. Both rely on
 * SDK-derived data only; the TradingView widget is the only place we
 * reach for an external feed (Coinbase/Binance via TV's free embed).
 */
function ChartSwitcher({
  market,
  preview,
  amount,
}: {
  market: MarketView;
  preview: PreviewState | null;
  amount: number;
}) {
  const [tab, setTab] = useState<ChartTab>('payout');
  return (
    <div>
      <div className="mb-2 flex items-center gap-1 rounded-md border border-line bg-bg-subtle p-0.5">
        <TabButton active={tab === 'payout'} onClick={() => setTab('payout')}>
          Payout
        </TabButton>
        <TabButton active={tab === 'spot'} onClick={() => setTab('spot')}>
          {market.asset} chart
        </TabButton>
      </div>
      {tab === 'payout' ? (
        <PayoutChart
          market={market}
          numContracts={preview?.numContracts ?? null}
          betUsd={amount}
        />
      ) : (
        <TradingViewChart asset={market.asset} height={240} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'press-scale flex-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors duration-120',
        active
          ? 'bg-text text-bg-elev'
          : 'text-text-muted hover:text-text'
      )}
    >
      {children}
    </button>
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

function TradePanelSkeleton() {
  return (
    <div
      aria-label="Loading trade panel"
      className="rounded-xl border border-line bg-bg-elev p-4 animate-fade-in"
    >
      <div className="flex items-center justify-between">
        <div className="h-5 w-32 animate-pulse rounded bg-surface-hover" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-surface-hover" />
      </div>
      <div className="mt-3 h-10 w-full animate-pulse rounded bg-surface-hover" />
      <div className="mt-4 grid grid-cols-5 gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded-md bg-surface-hover"
          />
        ))}
      </div>
      <div className="mt-4 h-24 w-full animate-pulse rounded-lg bg-surface-hover" />
      <div className="mt-3 h-9 w-full animate-pulse rounded-md bg-surface-hover" />
      <div className="mt-4 h-12 w-full animate-pulse rounded-md bg-surface-hover" />
    </div>
  );
}

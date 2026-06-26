'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  CheckCircle2,
  CircleDashed,
  MessageSquare,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  AdminData,
  AdminFeedbackRow,
  AdminTradeRow,
  AdminTraderRow,
  AdminWaitlistRow,
} from '@/lib/admin/queries';
import { fmtTimeAgo, fmtUsd, shortAddress } from '@/lib/utils';
import { ADMIN_ACCENT } from './theme';

type Tab = 'waitlist' | 'trades' | 'traders' | 'feedback';

const TABS: { id: Tab; label: string }[] = [
  { id: 'waitlist', label: 'Waitlist' },
  { id: 'trades', label: 'Trades' },
  { id: 'traders', label: 'Traders' },
  { id: 'feedback', label: 'Feedback' },
];

export function AdminDashboard({ initial }: { initial: AdminData }) {
  const router = useRouter();
  const [data, setData] = useState<AdminData>(initial);
  const [tab, setTab] = useState<Tab>('waitlist');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/data', { cache: 'no-store' });
      if (res.status === 401) {
        // Session expired — drop back to the login screen.
        router.refresh();
        return;
      }
      if (!res.ok) {
        setError('Could not refresh.');
        return;
      }
      setData((await res.json()) as AdminData);
      setQuery('');
    } catch {
      setError('Network error.');
    } finally {
      setRefreshing(false);
    }
  }

  const m = data.metrics;

  return (
    <div className="flex flex-col gap-6">
      {/* Header row */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-white">Dashboard</h1>
          <p className="mt-0.5 text-xs text-white/40">
            Updated {fmtTimeAgo(data.generatedAt)}
            {data.truncated && ' · money totals reflect the latest records only'}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
          Refresh
        </button>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={Users} label="Waitlist" value={m.waitlistTotal.toLocaleString()} sub={`+${m.waitlistLast24h} today · +${m.waitlistLast7d} / 7d`} />
        <Kpi icon={CheckCircle2} label="Activated" value={`${m.activatedWallets}/${m.waitlistWithWallet}`} sub="wallets that traded" />
        <Kpi icon={Wallet} label="Traders" value={m.tradersTotal.toLocaleString()} sub="distinct addresses" />
        <Kpi icon={Activity} label="Trades" value={m.tradesTotal.toLocaleString()} sub={`${m.settledTrades.toLocaleString()} settled`} />
        <Kpi icon={TrendingUp} label="Volume" value={fmtUsd(m.volumeUsdc, { compact: true })} sub={m.winRate == null ? 'win rate —' : `${m.winRate.toFixed(0)}% win rate`} />
        <Kpi icon={MessageSquare} label="Feedback" value={m.feedbackTotal.toLocaleString()} sub="messages" />
      </div>

      {/* Activation funnel */}
      <ActivationBar
        signups={m.waitlistTotal}
        withWallet={m.waitlistWithWallet}
        activated={m.activatedWallets}
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setQuery('');
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                on
                  ? 'bg-white text-[#0f131b]'
                  : 'border border-white/[0.08] bg-white/[0.02] text-white/55 hover:text-white'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 tabular-nums ${on ? 'text-[#0f131b]/50' : 'text-white/30'}`}>
                {tabCount(data, t.id)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder(tab)}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none"
        />
      </div>

      {/* Tab body */}
      {tab === 'waitlist' && <WaitlistTable rows={data.waitlist} query={query} />}
      {tab === 'trades' && <TradesTable rows={data.trades} query={query} />}
      {tab === 'traders' && <TradersTable rows={data.traders} query={query} />}
      {tab === 'feedback' && <FeedbackList rows={data.feedback} query={query} />}
    </div>
  );
}

function tabCount(d: AdminData, t: Tab): number {
  if (t === 'waitlist') return d.waitlist.length;
  if (t === 'trades') return d.trades.length;
  if (t === 'traders') return d.traders.length;
  return d.feedback.length;
}

function searchPlaceholder(t: Tab): string {
  if (t === 'waitlist') return 'Search email, wallet, source…';
  if (t === 'trades') return 'Search address, market, side, tx…';
  if (t === 'traders') return 'Search address…';
  return 'Search message, email, category…';
}

// ─── KPI card ────────────────────────────────────────────────────────────────
function Kpi({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-1.5 text-white/40">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <div className="mt-1.5 font-display text-xl font-bold tabular-nums text-white">{value}</div>
      <div className="mt-0.5 truncate text-[11px] text-white/35">{sub}</div>
    </div>
  );
}

// ─── Activation funnel ───────────────────────────────────────────────────────
function ActivationBar({
  signups,
  withWallet,
  activated,
}: {
  signups: number;
  withWallet: number;
  activated: number;
}) {
  const pct = withWallet > 0 ? Math.round((activated / withWallet) * 100) : 0;
  const dormant = Math.max(0, withWallet - activated);
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono uppercase tracking-[0.14em] text-white/40">Activation</span>
        <span className="text-white/55">
          <span className="font-semibold text-white">{activated}</span> of {withWallet} wallets traded
          {withWallet > 0 && <span className="ml-1.5 text-white/35">({pct}%)</span>}
        </span>
      </div>
      <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-l-full"
          style={{ width: `${pct}%`, background: ADMIN_ACCENT }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-white/40">
        <span>{signups.toLocaleString()} total signups</span>
        <span>{withWallet.toLocaleString()} left a wallet</span>
        <span className="text-emerald-400/80">{activated.toLocaleString()} activated</span>
        <span className="text-white/45">{dormant.toLocaleString()} dormant</span>
      </div>
    </div>
  );
}

// ─── shared table chrome ─────────────────────────────────────────────────────
function TablePanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <div className="scrollbar-thin overflow-x-auto">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-12 text-center text-sm text-white/35">{children}</div>;
}

const SIDE_COLOR: Record<string, string> = {
  PUMP: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  DUMP: 'text-rose-400 border-rose-400/30 bg-rose-400/10',
  RANGE: 'text-violet-400 border-violet-400/30 bg-violet-400/10',
};

function SideTag({ side }: { side: string | null }) {
  const s = (side ?? '').toUpperCase();
  const cls = SIDE_COLOR[s];
  if (!cls) return <span className="text-white/25">—</span>;
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${cls}`}>
      {s}
    </span>
  );
}

// ─── Waitlist ────────────────────────────────────────────────────────────────
type WaitFilter = 'all' | 'activated' | 'dormant' | 'no-wallet';

function WaitlistTable({ rows, query }: { rows: AdminWaitlistRow[]; query: string }) {
  const [filter, setFilter] = useState<WaitFilter>('all');
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === 'activated' && r.activated !== true) return false;
      if (filter === 'dormant' && !(r.wallet_address && r.activated === false)) return false;
      if (filter === 'no-wallet' && r.wallet_address) return false;
      if (!q) return true;
      return (
        r.email.toLowerCase().includes(q) ||
        (r.wallet_address ?? '').toLowerCase().includes(q) ||
        (r.source ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, filter, q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', 'All'],
            ['activated', 'Activated'],
            ['dormant', 'Dormant'],
            ['no-wallet', 'No wallet'],
          ] as [WaitFilter, string][]
        ).map(([id, label]) => (
          <FilterPill key={id} on={filter === id} onClick={() => setFilter(id)}>
            {label}
          </FilterPill>
        ))}
      </div>

      <TablePanel>
        <div className="min-w-[44rem]">
          <Header cols="grid-cols-[1.6fr_1.2fr_5rem_6rem_6rem]">
            <div>Email</div>
            <div>Wallet</div>
            <div>Source</div>
            <div className="text-right">Status</div>
            <div className="text-right">Joined</div>
          </Header>
          <div className="divide-y divide-white/[0.05]">
            {filtered.length === 0 ? (
              <Empty>No signups match.</Empty>
            ) : (
              filtered.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1.6fr_1.2fr_5rem_6rem_6rem] items-center gap-2 px-4 py-2.5 text-sm"
                >
                  <div className="truncate text-white/85">{r.email}</div>
                  <div className="truncate font-mono text-xs text-white/45">
                    {r.wallet_address ? shortAddress(r.wallet_address) : '—'}
                  </div>
                  <div className="truncate text-xs text-white/45">{r.source ?? '—'}</div>
                  <div className="flex justify-end">
                    <StatusBadge row={r} />
                  </div>
                  <div className="text-right text-xs text-white/40">{fmtTimeAgo(r.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </TablePanel>
    </div>
  );
}

function StatusBadge({ row }: { row: AdminWaitlistRow }) {
  if (!row.wallet_address)
    return <span className="font-mono text-[10px] uppercase tracking-wide text-white/30">no wallet</span>;
  if (row.activated)
    return (
      <span className="inline-flex items-center gap-1 rounded border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-400">
        <CheckCircle2 className="h-3 w-3" aria-hidden /> traded
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white/40">
      <CircleDashed className="h-3 w-3" aria-hidden /> dormant
    </span>
  );
}

// ─── Trades ──────────────────────────────────────────────────────────────────
function TradesTable({ rows, query }: { rows: AdminTradeRow[]; query: string }) {
  const [settled, setSettled] = useState<'all' | 'settled' | 'open'>('all');
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (settled === 'settled' && r.pnl_usdc == null) return false;
      if (settled === 'open' && r.pnl_usdc != null) return false;
      if (!q) return true;
      return (
        r.taker_address.toLowerCase().includes(q) ||
        (r.market_label ?? '').toLowerCase().includes(q) ||
        (r.side ?? '').toLowerCase().includes(q) ||
        r.tx_hash.toLowerCase().includes(q)
      );
    });
  }, [rows, settled, q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', 'All'],
            ['settled', 'Settled'],
            ['open', 'Open'],
          ] as ['all' | 'settled' | 'open', string][]
        ).map(([id, label]) => (
          <FilterPill key={id} on={settled === id} onClick={() => setSettled(id)}>
            {label}
          </FilterPill>
        ))}
      </div>

      <TablePanel>
        <div className="min-w-[46rem]">
          <Header cols="grid-cols-[5rem_1fr_1fr_5rem_6rem_6rem]">
            <div>Side</div>
            <div>Market</div>
            <div>Trader</div>
            <div className="text-right">Notional</div>
            <div className="text-right">PnL</div>
            <div className="text-right">When</div>
          </Header>
          <div className="divide-y divide-white/[0.05]">
            {filtered.length === 0 ? (
              <Empty>No trades match.</Empty>
            ) : (
              filtered.map((r) => (
                <div
                  key={`${r.tx_hash}-${r.option_id}`}
                  className="grid grid-cols-[5rem_1fr_1fr_5rem_6rem_6rem] items-center gap-2 px-4 py-2.5 text-sm"
                >
                  <div>
                    <SideTag side={r.side} />
                  </div>
                  <div className="truncate text-white/80">{r.market_label ?? 'Option'}</div>
                  <div className="truncate font-mono text-xs text-white/45">
                    {shortAddress(r.taker_address)}
                  </div>
                  <div className="text-right tabular-nums text-white/80">
                    {r.notional_usdc > 0 ? fmtUsd(r.notional_usdc) : '—'}
                  </div>
                  <div className="text-right">
                    <PnlCell pnl={r.pnl_usdc} />
                  </div>
                  <div className="text-right text-xs text-white/40">{fmtTimeAgo(r.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </TablePanel>
    </div>
  );
}

function PnlCell({ pnl }: { pnl: number | null }) {
  if (pnl == null) return <span className="text-xs text-white/30">open</span>;
  if (pnl === 0) return <span className="tabular-nums text-white/45">—</span>;
  const cls = pnl > 0 ? 'text-emerald-400' : 'text-rose-400';
  return (
    <span className={`tabular-nums font-semibold ${cls}`}>
      {pnl > 0 ? '+' : ''}
      {fmtUsd(pnl)}
    </span>
  );
}

// ─── Traders ─────────────────────────────────────────────────────────────────
function TradersTable({ rows, query }: { rows: AdminTraderRow[]; query: string }) {
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? rows.filter((r) => r.address.toLowerCase().includes(q)) : rows),
    [rows, q],
  );

  return (
    <TablePanel>
      <div className="min-w-[40rem]">
        <Header cols="grid-cols-[3rem_1fr_5rem_5rem_6rem_7rem]">
          <div>#</div>
          <div>Trader</div>
          <div className="text-right">Trades</div>
          <div className="text-right">Wins</div>
          <div className="text-right">Win rate</div>
          <div className="text-right">Realized PnL</div>
        </Header>
        <div className="divide-y divide-white/[0.05]">
          {filtered.length === 0 ? (
            <Empty>No traders yet.</Empty>
          ) : (
            filtered.map((r, i) => {
              const pnl = r.realized_pnl;
              const cls = pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-rose-400' : 'text-white/40';
              return (
                <div
                  key={r.address}
                  className="grid grid-cols-[3rem_1fr_5rem_5rem_6rem_7rem] items-center gap-2 px-4 py-2.5 text-sm tabular-nums"
                >
                  <div className="text-white/40">{i + 1}</div>
                  <div className="truncate font-mono text-white/80">{shortAddress(r.address)}</div>
                  <div className="text-right text-white/70">{r.total_trades.toLocaleString()}</div>
                  <div className="text-right text-white/70">{r.wins.toLocaleString()}</div>
                  <div className="text-right text-white/55">
                    {r.win_rate == null ? '—' : `${r.win_rate.toFixed(1)}%`}
                  </div>
                  <div className={`text-right font-semibold ${cls}`}>
                    {pnl === 0 ? '—' : `${pnl > 0 ? '+' : ''}${fmtUsd(pnl)}`}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </TablePanel>
  );
}

// ─── Feedback ────────────────────────────────────────────────────────────────
function FeedbackList({ rows, query }: { rows: AdminFeedbackRow[]; query: string }) {
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? rows.filter(
            (r) =>
              r.message.toLowerCase().includes(q) ||
              (r.email ?? '').toLowerCase().includes(q) ||
              (r.category ?? '').toLowerCase().includes(q),
          )
        : rows,
    [rows, q],
  );

  if (filtered.length === 0)
    return (
      <TablePanel>
        <Empty>No feedback{q ? ' matches' : ' yet'}.</Empty>
      </TablePanel>
    );

  return (
    <div className="flex flex-col gap-2.5">
      {filtered.map((r) => (
        <div key={r.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
            {r.category && (
              <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono uppercase tracking-wide text-white/55">
                {r.category}
              </span>
            )}
            {r.page_path && <span className="font-mono text-white/35">{r.page_path}</span>}
            <span className="ml-auto text-white/35">{fmtTimeAgo(r.created_at)}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{r.message}</p>
          {(r.email || r.wallet_address) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40">
              {r.email && <span>{r.email}</span>}
              {r.wallet_address && <span className="font-mono">{shortAddress(r.wallet_address)}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── primitives ──────────────────────────────────────────────────────────────
function Header({ cols, children }: { cols: string; children: React.ReactNode }) {
  return (
    <div
      className={`grid ${cols} gap-2 border-b border-white/[0.06] px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-white/35`}
    >
      {children}
    </div>
  );
}

function FilterPill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
        on
          ? 'bg-white/90 text-[#0f131b]'
          : 'border border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

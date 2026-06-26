import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Admin dashboard data ────────────────────────────────────────────────────
// Read with the SERVICE-ROLE client (bypasses RLS) — this is the only way to
// see the write-only `waitlist` and `feedback` tables. NEVER call this with the
// anon/browser client and NEVER ship the results to a page that isn't behind
// the admin gate.
//
// Headline counts use exact head-counts (cheap, accurate at any scale). Money
// sums (volume, realized PnL) are computed over the fetched rows: fine for an
// early-stage internal tool. If row counts ever blow past the caps below, swap
// the sums for a Postgres RPC and the truncation flags will tell you when.

const WAITLIST_CAP = 2000;
const TRADES_CAP = 1000;
const SETTLE_CAP = 2000;
const LEADERBOARD_CAP = 1000;
const FEEDBACK_CAP = 500;

export interface AdminWaitlistRow {
  id: number;
  email: string;
  wallet_address: string | null;
  source: string | null;
  referrer: string | null;
  created_at: string;
  /** Did this signup's wallet go on to actually trade? null when no wallet given. */
  activated: boolean | null;
}

export interface AdminTradeRow {
  id: number;
  tx_hash: string;
  option_id: string;
  taker_address: string;
  market_label: string | null;
  side: string | null;
  contracts: number;
  notional_usdc: number;
  entry_price: number | null;
  created_at: string;
  /** Realized PnL once settled; null while the trade is still open. */
  pnl_usdc: number | null;
  is_win: boolean | null;
}

export interface AdminTraderRow {
  address: string;
  total_trades: number;
  wins: number;
  win_rate: number | null;
  realized_pnl: number;
  last_trade_at: string | null;
}

export interface AdminFeedbackRow {
  id: number;
  message: string;
  category: string | null;
  email: string | null;
  wallet_address: string | null;
  page_path: string | null;
  created_at: string;
}

export interface AdminMetrics {
  waitlistTotal: number;
  waitlistWithWallet: number;
  waitlistLast24h: number;
  waitlistLast7d: number;
  /** Waitlist wallets that appear in the traders table (signed up AND traded). */
  activatedWallets: number;
  tradersTotal: number;
  tradesTotal: number;
  settledTrades: number;
  volumeUsdc: number;
  realizedPnl: number;
  winRate: number | null;
  feedbackTotal: number;
}

export interface AdminData {
  metrics: AdminMetrics;
  waitlist: AdminWaitlistRow[];
  trades: AdminTradeRow[];
  traders: AdminTraderRow[];
  feedback: AdminFeedbackRow[];
  /** True when any list hit its cap, so the UI can flag partial money sums. */
  truncated: boolean;
  generatedAt: string;
}

type Row = Record<string, unknown>;

async function rows(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> {
  const { data, error } = await p;
  if (error) return [];
  return (data as Row[]) ?? [];
}

async function count(p: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count: c, error } = await p;
  if (error) return 0;
  return c ?? 0;
}

export async function loadAdminData(
  sb: SupabaseClient,
  now: number = Date.now(),
): Promise<AdminData> {
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    waitlistRaw,
    waitlistTotal,
    waitlistLast24h,
    waitlistLast7d,
    tradesRaw,
    tradesTotal,
    tradersRaw,
    tradersTotal,
    settlementsRaw,
    settledTrades,
    leaderboardRaw,
    feedbackRaw,
    feedbackTotal,
  ] = await Promise.all([
    rows(
      sb
        .from('waitlist')
        .select('id,email,wallet_address,source,referrer,created_at')
        .order('created_at', { ascending: false })
        .limit(WAITLIST_CAP),
    ),
    count(sb.from('waitlist').select('*', { count: 'exact', head: true })),
    count(sb.from('waitlist').select('*', { count: 'exact', head: true }).gte('created_at', since24h)),
    count(sb.from('waitlist').select('*', { count: 'exact', head: true }).gte('created_at', since7d)),
    rows(
      sb
        .from('trades')
        .select(
          'id,tx_hash,option_id,taker_address,market_label,side,contracts,notional_usdc,entry_price,created_at',
        )
        .order('created_at', { ascending: false })
        .limit(TRADES_CAP),
    ),
    count(sb.from('trades').select('*', { count: 'exact', head: true })),
    rows(sb.from('traders').select('address,first_seen_at').limit(LEADERBOARD_CAP)),
    count(sb.from('traders').select('*', { count: 'exact', head: true })),
    rows(
      sb
        .from('settlements')
        .select('trade_id,pnl_usdc,is_win')
        .order('settled_at', { ascending: false })
        .limit(SETTLE_CAP),
    ),
    count(sb.from('settlements').select('*', { count: 'exact', head: true })),
    rows(
      sb
        .from('leaderboard_v')
        .select('address,total_trades,wins,win_rate,realized_pnl,last_trade_at')
        .order('realized_pnl', { ascending: false })
        .limit(LEADERBOARD_CAP),
    ),
    rows(
      sb
        .from('feedback')
        .select('id,message,category,email,wallet_address,page_path,created_at')
        .order('created_at', { ascending: false })
        .limit(FEEDBACK_CAP),
    ),
    count(sb.from('feedback').select('*', { count: 'exact', head: true })),
  ]);

  // Addresses that have actually traded — used to flag waitlist activation.
  const traderSet = new Set(
    tradersRaw.map((t) => String(t.address ?? '').toLowerCase()).filter(Boolean),
  );

  // Map settlement → trade so the trades table can show realized PnL inline.
  const settleByTrade = new Map<number, { pnl: number; win: boolean }>();
  for (const s of settlementsRaw) {
    settleByTrade.set(Number(s.trade_id), {
      pnl: Number(s.pnl_usdc),
      win: Boolean(s.is_win),
    });
  }

  let activatedWallets = 0;
  let waitlistWithWallet = 0;
  const waitlist: AdminWaitlistRow[] = waitlistRaw.map((w) => {
    const wallet = (w.wallet_address as string | null) ?? null;
    let activated: boolean | null = null;
    if (wallet) {
      waitlistWithWallet += 1;
      activated = traderSet.has(wallet.toLowerCase());
      if (activated) activatedWallets += 1;
    }
    return {
      id: Number(w.id),
      email: String(w.email ?? ''),
      wallet_address: wallet,
      source: (w.source as string | null) ?? null,
      referrer: (w.referrer as string | null) ?? null,
      created_at: String(w.created_at ?? ''),
      activated,
    };
  });

  let volumeUsdc = 0;
  const trades: AdminTradeRow[] = tradesRaw.map((t) => {
    const notional = Number(t.notional_usdc) || 0;
    volumeUsdc += notional;
    const settle = settleByTrade.get(Number(t.id));
    return {
      id: Number(t.id),
      tx_hash: String(t.tx_hash ?? ''),
      option_id: String(t.option_id ?? ''),
      taker_address: String(t.taker_address ?? ''),
      market_label: (t.market_label as string | null) ?? null,
      side: (t.side as string | null) ?? null,
      contracts: Number(t.contracts) || 0,
      notional_usdc: notional,
      entry_price: t.entry_price == null ? null : Number(t.entry_price),
      created_at: String(t.created_at ?? ''),
      pnl_usdc: settle ? settle.pnl : null,
      is_win: settle ? settle.win : null,
    };
  });

  const traders: AdminTraderRow[] = leaderboardRaw.map((r) => ({
    address: String(r.address ?? ''),
    total_trades: Number(r.total_trades) || 0,
    wins: Number(r.wins) || 0,
    win_rate: r.win_rate == null ? null : Number(r.win_rate),
    realized_pnl: Number(r.realized_pnl) || 0,
    last_trade_at: (r.last_trade_at as string | null) ?? null,
  }));

  const feedback: AdminFeedbackRow[] = feedbackRaw.map((f) => ({
    id: Number(f.id),
    message: String(f.message ?? ''),
    category: (f.category as string | null) ?? null,
    email: (f.email as string | null) ?? null,
    wallet_address: (f.wallet_address as string | null) ?? null,
    page_path: (f.page_path as string | null) ?? null,
    created_at: String(f.created_at ?? ''),
  }));

  const totalWins = traders.reduce((sum, t) => sum + t.wins, 0);
  const realizedPnl = traders.reduce((sum, t) => sum + t.realized_pnl, 0);
  const winRate = settledTrades > 0 ? (totalWins / settledTrades) * 100 : null;

  const truncated =
    waitlistRaw.length >= WAITLIST_CAP ||
    tradesRaw.length >= TRADES_CAP ||
    settlementsRaw.length >= SETTLE_CAP;

  return {
    metrics: {
      waitlistTotal,
      waitlistWithWallet,
      waitlistLast24h,
      waitlistLast7d,
      activatedWallets,
      tradersTotal,
      tradesTotal,
      settledTrades,
      volumeUsdc,
      realizedPnl,
      winRate,
      feedbackTotal,
    },
    waitlist,
    trades,
    traders,
    feedback,
    truncated,
    generatedAt: new Date(now).toISOString(),
  };
}

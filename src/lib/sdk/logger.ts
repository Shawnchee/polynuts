import type { ThetanutsLogger } from '@thetanuts-finance/thetanuts-client';

type Reporter = (msg: string, meta?: unknown) => void;

/**
 * Sentry-shaped logger sink. We don't ship the Sentry SDK by default, but the
 * logger interface here is the integration point — wire window.Sentry (loaded
 * via @sentry/nextjs) into `report` to forward warnings and errors.
 */
const report: Reporter = (msg, meta) => {
  const sentry = (globalThis as { Sentry?: { captureMessage?: (m: string, ctx?: unknown) => void } })
    .Sentry;
  if (sentry?.captureMessage) {
    try {
      sentry.captureMessage(msg, { extra: meta });
    } catch {
      /* swallow — never throw out of the logger */
    }
  }
};

/**
 * Some SDK errors are expected on free-tier RPC plans and aren't actionable
 * for the user. We downgrade them to info-level so they don't fill the
 * console with red noise. The handful of patterns here cover Alchemy /
 * QuickNode / Infura free-tier rate-limit messages.
 */
function isExpectedFreeTierNoise(msg: string, meta: unknown): boolean {
  const text = (() => {
    if (typeof meta === 'string') return msg + ' ' + meta;
    const m = meta as { error?: { message?: string } } | undefined;
    return msg + ' ' + (m?.error?.message ?? JSON.stringify(meta ?? {}));
  })();
  return (
    /Free tier plan/i.test(text) ||
    /eth_getLogs requests with up to a \d+ block range/i.test(text) ||
    /rate.?limit/i.test(text) ||
    /-32600/i.test(text) // generic JSON-RPC "request out of bounds"
  );
}

export const polynutsLogger: ThetanutsLogger = {
  debug(msg, meta) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug(`[sdk] ${msg}`, meta ?? '');
    }
  },
  info(msg, meta) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.info(`[sdk] ${msg}`, meta ?? '');
    }
  },
  warn(msg, meta) {
    // eslint-disable-next-line no-console
    console.warn(`[sdk] ${msg}`, meta ?? '');
    report(`[sdk warn] ${msg}`, meta);
  },
  error(msg, meta) {
    if (isExpectedFreeTierNoise(msg, meta)) {
      // eslint-disable-next-line no-console
      console.info(`[sdk] ${msg} (free-tier RPC, expected)`);
      return;
    }
    // eslint-disable-next-line no-console
    console.error(`[sdk] ${msg}`, meta ?? '');
    report(`[sdk error] ${msg}`, meta);
  },
};

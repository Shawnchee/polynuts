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
    // eslint-disable-next-line no-console
    console.error(`[sdk] ${msg}`, meta ?? '');
    report(`[sdk error] ${msg}`, meta);
  },
};

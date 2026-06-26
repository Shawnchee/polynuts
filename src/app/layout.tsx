import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inter, JetBrains_Mono, Bricolage_Grotesque } from 'next/font/google';
import { Providers } from './providers';
import { NavProgress } from '@/components/nav/NavProgress';
import { Analytics } from '@vercel/analytics/next';
import { themeBootScript } from '@/lib/theme';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// Display/brand face — wordmark + headings. Inter stays the body/UI workhorse
// and JetBrains Mono stays for tabular data; Bricolage Grotesque carries the
// characterful, slightly-rebellious display personality on top-level type.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '500', '700'],
  display: 'swap',
});

const SITE_DESCRIPTION =
  'A prediction market for crypto options. Bet PUMP or DUMP on ETH and BTC with USDC. Powered by Thetanuts Finance V4 on Base.';

// Reuse the live share-card renderer for the default unfurl image. `pending`
// shows the direction-tinted "BETTING" treatment, which reads well as a
// generic marketing card for a link to the markets page.
const OG_IMAGE = '/api/win-card?result=pending';

export const metadata: Metadata = {
  title: {
    default: 'Polynuts — Bet on crypto, on-chain',
    template: '%s · Polynuts',
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL('https://polynuts.xyz'),
  applicationName: 'Polynuts',
  keywords: [
    'prediction market',
    'crypto options',
    'ETH',
    'BTC',
    'USDC',
    'Base',
    'Thetanuts',
    'on-chain betting',
  ],
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'Polynuts — Bet on crypto, on-chain',
    description: 'Bet PUMP or DUMP on crypto. Real options under the hood.',
    type: 'website',
    siteName: 'Polynuts',
    url: 'https://polynuts.xyz',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Polynuts — bet PUMP or DUMP on crypto with USDC',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Polynuts — Bet on crypto, on-chain',
    description: 'Bet PUMP or DUMP on crypto. Real options under the hood.',
    images: [OG_IMAGE],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} ${bricolage.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        {/* Global route-change progress bar — wrapped in Suspense because it
            reads useSearchParams (avoids forcing the whole tree to client CSR). */}
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}

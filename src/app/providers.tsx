'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, lightTheme, darkTheme } from '@rainbow-me/rainbowkit';
import { Toaster } from 'sonner';
import { wagmiConfig } from '@/lib/wagmi';
import { useTheme } from '@/lib/theme';
import { LiveFeedBoot } from '@/components/system/LiveFeedBoot';
import { FeedbackWidget } from '@/components/system/FeedbackWidget';
import '@rainbow-me/rainbowkit/styles.css';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemedRainbowKit>
          <LiveFeedBoot />
          {children}
          <FeedbackWidget />
          <Toaster
            position="top-right"
            theme="system"
            toastOptions={{
              style: {
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '13px',
              },
              className: 'rounded-md',
            }}
          />
        </ThemedRainbowKit>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function ThemedRainbowKit({ children }: { children: ReactNode }) {
  // useTheme reports the SSR-default theme until mounted, so RainbowKit's
  // theme-dependent injected styles match the server HTML on first render
  // (no hydration mismatch); it then switches to the real theme post-mount.
  const { theme } = useTheme();
  const rk =
    theme === 'dark'
      ? darkTheme({
          accentColor: '#60A5FA',
          accentColorForeground: '#0B1220',
          borderRadius: 'medium',
          fontStack: 'system',
          overlayBlur: 'small',
        })
      : lightTheme({
          accentColor: '#2563EB',
          accentColorForeground: 'white',
          borderRadius: 'medium',
          fontStack: 'system',
        });
  return (
    <RainbowKitProvider theme={rk} modalSize="compact">
      {children}
    </RainbowKitProvider>
  );
}

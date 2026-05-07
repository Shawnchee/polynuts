'use client';

import { useTheme } from '@/lib/theme';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'press-scale relative flex h-9 w-9 items-center justify-center rounded-full',
        'border border-line bg-surface text-text transition-colors duration-180',
        'hover:bg-surface-hover'
      )}
    >
      <Sun
        className={cn(
          'absolute h-4 w-4 transition-all duration-240',
          isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
        )}
      />
      <Moon
        className={cn(
          'absolute h-4 w-4 transition-all duration-240',
          isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
        )}
      />
    </button>
  );
}

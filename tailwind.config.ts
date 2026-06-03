import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563EB',
          dark: '#1D4ED8',
          light: '#EFF6FF',
          glow: 'rgba(37, 99, 235, 0.35)',
        },
        gold: {
          DEFAULT: '#F59E0B',
          glow: 'rgba(245, 158, 11, 0.35)',
        },
        pump: {
          DEFAULT: '#16A34A',
          dark: '#22C55E',
          light: '#F0FDF4',
          border: '#86EFAC',
          glow: 'rgba(34, 197, 94, 0.35)',
        },
        dump: {
          DEFAULT: '#DC2626',
          dark: '#F43F5E',
          light: '#FEF2F2',
          border: '#FECACA',
          glow: 'rgba(244, 63, 94, 0.35)',
        },
        range: {
          DEFAULT: '#7C3AED',
          dark: '#A78BFA',
          light: '#F5F3FF',
          border: '#C4B5FD',
          glow: 'rgba(167, 139, 250, 0.35)',
        },
        ink: {
          900: '#09090B',
          600: '#52525B',
          400: '#A1A1AA',
          200: '#E4E4E7',
          100: '#F4F4F5',
          50: '#FAFAFA',
        },
        // Semantic tokens — drive themes via CSS vars
        bg: {
          DEFAULT: 'rgb(var(--bg) / <alpha-value>)',
          subtle: 'rgb(var(--bg-subtle) / <alpha-value>)',
          elev: 'rgb(var(--bg-elev) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          hover: 'rgb(var(--surface-hover) / <alpha-value>)',
        },
        line: 'rgb(var(--line) / <alpha-value>)',
        text: {
          DEFAULT: 'rgb(var(--text) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
          dim: 'rgb(var(--text-dim) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
        display: [
          'var(--font-space-grotesk)',
          'var(--font-inter)',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        xs: ['10px', { lineHeight: '14px', letterSpacing: '0.6px' }],
        sm: ['12px', { lineHeight: '16px' }],
        base: ['13px', { lineHeight: '18px' }],
        md: ['15px', { lineHeight: '20px' }],
        lg: ['18px', { lineHeight: '24px' }],
        xl: ['24px', { lineHeight: '28px', letterSpacing: '-0.5px' }],
        '2xl': ['32px', { lineHeight: '36px', letterSpacing: '-0.8px' }],
        '3xl': ['44px', { lineHeight: '48px', letterSpacing: '-1.2px' }],
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '24px',
        full: '9999px',
      },
      borderWidth: {
        DEFAULT: '0.5px',
        '0.5': '0.5px',
        '1.5': '1.5px',
      },
      maxWidth: {
        page: '1440px',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)', // exponential out — feels premium
      },
      transitionDuration: {
        '120': '120ms',
        '180': '180ms',
        '240': '240ms',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 var(--glow)' },
          '50%': { boxShadow: '0 0 24px 6px var(--glow)' },
        },
        'shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
        'blob': {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(40px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-30px, 30px) scale(0.9)' },
        },
        'tick': {
          '0%': { background: 'var(--tick-from)' },
          '100%': { background: 'transparent' },
        },
      },
      animation: {
        'fade-in': 'fade-in 280ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in-down': 'fade-in-down 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slide-in-right 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        'shimmer': 'shimmer 1.6s ease-in-out infinite',
        'blob': 'blob 18s ease-in-out infinite',
        'tick': 'tick 800ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;

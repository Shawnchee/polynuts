import type { Config } from 'tailwindcss';

const config: Config = {
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
        },
        pump: {
          DEFAULT: '#16A34A',
          light: '#F0FDF4',
          border: '#86EFAC',
        },
        dump: {
          DEFAULT: '#DC2626',
          light: '#FEF2F2',
          border: '#FECACA',
        },
        range: {
          DEFAULT: '#7C3AED',
          light: '#F5F3FF',
          border: '#C4B5FD',
        },
        ink: {
          900: '#09090B',
          600: '#52525B',
          400: '#A1A1AA',
          200: '#E4E4E7',
          100: '#F4F4F5',
          50: '#FAFAFA',
        },
        success: '#16A34A',
        warning: '#D97706',
        error: '#DC2626',
        info: '#2563EB',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs: ['9px', { lineHeight: '12px', letterSpacing: '0.8px' }],
        sm: ['11px', { lineHeight: '14px' }],
        base: ['13px', { lineHeight: '18px' }],
        md: ['15px', { lineHeight: '20px' }],
        lg: ['18px', { lineHeight: '24px' }],
        xl: ['24px', { lineHeight: '28px', letterSpacing: '-0.5px' }],
        '2xl': ['28px', { lineHeight: '32px', letterSpacing: '-0.5px' }],
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
        full: '9999px',
      },
      borderWidth: {
        DEFAULT: '0.5px',
        '0.5': '0.5px',
        '1.5': '1.5px',
      },
      maxWidth: {
        page: '1280px',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        '120': '120ms',
        '200': '200ms',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-in-right': 'slide-in-right 200ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;

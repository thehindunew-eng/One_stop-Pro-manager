import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

/**
 * Grey-and-white glass system.
 *
 * The chrome is monochrome: a black 1px hairline around every glass surface, a
 * grey canvas behind it, and three semantic colours reserved for meaning (late,
 * attention, done). Depth comes from the hairline plus one soft shadow — no
 * coloured glow anywhere in the product.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy surface names kept so existing components keep working.
        // They are all neutral now: 900 = canvas, 850/800 = paper, 700 = sunken.
        ink: {
          900: '#e8eaee',
          850: '#ffffff',
          800: '#ffffff',
          700: '#f0f2f5',
          600: '#e5e8ed',
          500: '#d3d8e0',
        },
        /* The accent is graphite: buttons, active tabs and icons read as ink. */
        electric: { DEFAULT: '#111827', soft: '#111827', 600: '#1f2937', 700: '#000000' },
        mint: { ...colors.emerald, DEFAULT: '#047857' },
        amber: { ...colors.amber, DEFAULT: '#b45309' },
        rose: { ...colors.rose, DEFAULT: '#be123c' },
        cyan: { ...colors.cyan, DEFAULT: '#0e7490' },
      },
      fontFamily: {
        sans: [
          'var(--font-sans)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        // A small, deliberate scale. Nothing in the product goes below 11px.
        '2xs': ['11px', { lineHeight: '16px' }],
        xs: ['12px', { lineHeight: '18px' }],
        sm: ['13px', { lineHeight: '20px' }],
        base: ['14px', { lineHeight: '22px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '38px' }],
      },
      borderRadius: {
        md: '7px',
        lg: '9px',
        xl: '11px',
        '2xl': '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 15, 23, 0.06)',
        panel: '0 14px 30px -22px rgba(11, 15, 23, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
        pop: '0 24px 48px -24px rgba(11, 15, 23, 0.45), 0 2px 8px rgba(11, 15, 23, 0.08)',
        glass: '0 14px 30px -22px rgba(11, 15, 23, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
        glow: 'none',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.5' } },
      },
      animation: {
        'fade-up': 'fade-up .25s ease-out both',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;

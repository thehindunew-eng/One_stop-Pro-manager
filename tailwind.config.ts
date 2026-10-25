import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

/**
 * Restrained product palette.
 *
 * One accent (indigo), one neutral ramp (slate), three semantic colours used
 * only for meaning. No gradients, no glows — depth comes from 1px borders and
 * a single hairline shadow.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy surface names kept so existing components keep working.
        // They are all neutral now: 900 = canvas, 850/800 = paper, 700 = sunken.
        ink: {
          900: '#f7f8fa',
          850: '#ffffff',
          800: '#ffffff',
          700: '#f1f3f7',
          600: '#e8ebf1',
          500: '#d7dce5',
        },
        electric: { DEFAULT: '#4338ca', soft: '#4338ca', 600: '#4338ca', 700: '#3730a3' },
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
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.05)',
        panel: '0 1px 3px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04)',
        pop: '0 12px 32px -12px rgba(16, 24, 40, 0.18), 0 2px 6px rgba(16, 24, 40, 0.06)',
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

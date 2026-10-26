import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

/**
 * Liquid-glass system, cool graphite.
 *
 * The chrome is grey and white with a black 1px hairline around every surface;
 * the only colour is one deep-indigo accent and three semantic tones. Depth
 * comes from a translucent fill, a heavy backdrop blur, four specular insets
 * and one soft shadow — light, never neon.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy surface names kept so existing components keep working.
        // They are all neutral now: 900 = canvas, 850/800 = paper, 700 = sunken.
        ink: {
          900: '#dbe2ee',
          850: '#ffffff',
          800: '#ffffff',
          700: '#eef2f9',
          600: '#e2e8f2',
          500: '#cfd8e6',
        },
        /* One accent: deep indigo. It reads as ink with a blue undertone, which
           is how the product carries colour without looking colourful. */
        electric: { DEFAULT: '#1e2f57', soft: '#33477a', 600: '#2a3f6b', 700: '#16233f' },
        mint: { ...colors.emerald, DEFAULT: '#046c4e' },
        amber: { ...colors.amber, DEFAULT: '#8a4b06' },
        rose: { ...colors.rose, DEFAULT: '#9f1239' },
        cyan: { ...colors.cyan, DEFAULT: '#155e75' },
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
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 18, 32, 0.07)',
        panel:
          '0 1px 1px rgba(11, 18, 32, 0.08), 0 20px 38px -26px rgba(11, 18, 32, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.96), inset 0 -1px 0 rgba(255, 255, 255, 0.4)',
        pop: '0 2px 4px rgba(11, 18, 32, 0.08), 0 28px 56px -26px rgba(11, 18, 32, 0.5)',
        glass:
          '0 1px 1px rgba(11, 18, 32, 0.08), 0 20px 38px -26px rgba(11, 18, 32, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.96), inset 0 -1px 0 rgba(255, 255, 255, 0.4)',
        glow: 'none',
      },
      backdropBlur: {
        xs: '4px',
        glass: '30px',
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

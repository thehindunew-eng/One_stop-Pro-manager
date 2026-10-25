import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light, professional surfaces (names kept from the earlier theme so
        // components read the same, but the values are now paper + ink).
        ink: {
          900: '#f5f7fb',
          850: '#ffffff',
          800: '#ffffff',
          700: '#eef1f7',
          600: '#e3e8f1',
          500: '#cfd6e4',
        },
        electric: { DEFAULT: '#4f46e5', soft: '#4338ca' },
        mint: { ...colors.emerald, DEFAULT: '#059669' },
        amber: { ...colors.amber, DEFAULT: '#b45309' },
        rose: { ...colors.rose, DEFAULT: '#e11d48' },
        cyan: { ...colors.cyan, DEFAULT: '#0e7490' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 10px 30px -12px rgba(79,70,229,.45)',
        panel: '0 1px 2px rgba(16,24,40,.04), 0 12px 28px -18px rgba(16,24,40,.22)',
        card: '0 1px 2px rgba(16,24,40,.06)',
        pop: '0 20px 45px -20px rgba(16,24,40,.28)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.45' } },
        drift: { '0%,100%': { transform: 'translate3d(0,0,0)' }, '50%': { transform: 'translate3d(0,-14px,0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-up': 'fade-up .35s ease-out both',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        drift: 'drift 9s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        'spin-slow': 'spin-slow 9s linear infinite',
      },
    },
  },
  plugins: [],
};
export default config;

import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#070914',
          850: '#0a0d1c',
          800: '#0e1224',
          700: '#151a30',
          600: '#1d2440',
          500: '#2a3355',
        },
        electric: { DEFAULT: '#6366f1', soft: '#818cf8' },
        mint: '#34d399',
        amber: { ...colors.amber, DEFAULT: '#fbbf24' },
        rose: { ...colors.rose, DEFAULT: '#fb7185' },
        cyan: { ...colors.cyan, DEFAULT: '#22d3ee' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(99,102,241,.25), 0 18px 50px -12px rgba(99,102,241,.45)',
        panel: '0 24px 60px -30px rgba(0,0,0,.8)',
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

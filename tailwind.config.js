/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0F131A',
        card: '#161C25',
        raised: '#1C2330',
        line: '#28313E',
        'line-soft': '#202836',
        fg: '#E4E9F0',
        dim: '#96A2B3',
        faint: '#6C7787',
        accent: '#5B8DEF',
        'accent-soft': '#1E2A44',
        ok: '#3FB98C',
        'ok-soft': '#12291F',
        warn: '#E0A93F',
        'warn-soft': '#2B2213',
        bad: '#E8615A',
        'bad-soft': '#2E1817',
        info: '#5B8DEF',
        'info-soft': '#1B2540',
        neutral: '#7C8798',
        'neutral-soft': '#1E242E',
        violet: '#9C7BE8',
        'violet-soft': '#241D38',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.7)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 220ms ease-out both',
        'toast-in': 'toast-in 180ms ease-out both',
      },
    },
  },
  plugins: [],
};

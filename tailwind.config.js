/**
 * Colours are CSS variables (RGB triplets) so one class list renders both the
 * light dataset portal and the dark operations console. See src/index.css for
 * the two palettes.
 *
 * @type {import('tailwindcss').Config}
 */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: token('base'),
        card: token('card'),
        raised: token('raised'),
        line: token('line'),
        'line-soft': token('line-soft'),
        fg: token('fg'),
        dim: token('dim'),
        faint: token('faint'),
        accent: token('accent'),
        'accent-soft': token('accent-soft'),
        ok: token('ok'),
        'ok-soft': token('ok-soft'),
        warn: token('warn'),
        'warn-soft': token('warn-soft'),
        bad: token('bad'),
        'bad-soft': token('bad-soft'),
        info: token('info'),
        'info-soft': token('info-soft'),
        neutral: token('neutral'),
        'neutral-soft': token('neutral-soft'),
        violet: token('violet'),
        'violet-soft': token('violet-soft'),
        rose: token('rose'),
        'rose-soft': token('rose-soft'),
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
        panel:
          '0 1px 0 0 rgb(var(--c-inset) / 0.5) inset, 0 8px 24px -12px rgb(var(--c-shadow) / 0.7)',
        glow:
          '0 24px 70px -32px rgb(var(--c-glow) / 0.55), 0 2px 10px -6px rgb(var(--c-glow) / 0.35)',
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
        pulsebar: {
          '0%, 100%': { transform: 'scaleY(0.35)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 220ms ease-out both',
        'toast-in': 'toast-in 180ms ease-out both',
        'pulse-bar': 'pulsebar 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy alias kept for compatibility; prefer the `vc` scale below.
        felt: { DEFAULT: '#1b4332', dark: '#0b231c' },
        vc: {
          felt: {
            lamp: '#1b4332',
            DEFAULT: '#15392e',
            deep: '#103027',
            edge: '#0b231c',
          },
          rail: { DEFAULT: '#2a1e16', edge: '#4a372a', stitch: '#6b533e' },
          gold: { DEFAULT: '#f4c04a', deep: '#c8922e' },
          emerald: { DEFAULT: '#34d399', deep: '#0e9f6e' },
          ink: { DEFAULT: '#ede9e0', muted: '#9aa39b', faint: '#5e6a61' },
          danger: '#e0584b',
          chip: {
            1: '#edeae2',
            5: '#c2473d',
            25: '#2f8f6b',
            100: '#171717',
            500: '#6b4e9e',
            1000: '#c8922e',
          },
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightish: '-0.02em',
      },
    },
  },
  plugins: [],
};

export default config;

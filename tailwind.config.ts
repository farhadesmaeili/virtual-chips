import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#1b4332',
          dark: '#102a22',
        },
      },
    },
  },
  plugins: [],
};

export default config;

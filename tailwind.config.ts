import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        energy: {
          DEFAULT: '#10b981',
          light: '#6ee7b7',
          dark: '#047857',
        },
        navy: {
          DEFAULT: '#0f172a',
          deep: '#020617',
          surface: '#1e293b',
        },
        gold: '#FFD700',
        silver: '#C0C0C0',
        bronze: '#CD7F32',
      },
      spacing: {
        '128': '32rem',
      },
      borderRadius: {
        '3xl': '1.5rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(16,185,129,.15), 0 12px 32px rgba(16,185,129,.22)',
        float: '0 18px 45px rgba(0,0,0,.34)',
      },
    },
  },
  plugins: [],
};

export default config;

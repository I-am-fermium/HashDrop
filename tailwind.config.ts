import type { Config } from 'tailwindcss'

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#ffffff',
          foreground: '#0a0a0a',
        },
        accent: {
          DEFAULT: '#ff4757',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#979797',
          foreground: '#f5f5f5',
        },
        background: '#0a0a0a',
        foreground: '#ffffff',
      },
      fontFamily: {
        mono: ['Fira Code', 'Consolas', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
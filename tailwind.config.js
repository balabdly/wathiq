import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#1a56db',
          600: '#1240a8',
          700: '#0e3485',
        },
        accent: {
          50:  '#ecfdf5',
          500: '#0ea77b',
          600: '#087a57',
        },
        warn: {
          50:  '#fffbeb',
          500: '#e6820a',
          600: '#c06a00',
        },
        danger: {
          50:  '#fef2f2',
          500: '#c81e1e',
          600: '#991b1b',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
}
export default config

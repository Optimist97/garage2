/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      padding: {
        env: 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
}

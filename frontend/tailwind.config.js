/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': 'var(--bg-primary)',
        'felt-default': 'var(--felt-default)',
        'surface-panel': 'var(--surface-panel)',
        'surface-card': 'var(--surface-card)',
        'border-subtle': 'var(--border-subtle)',
        'neon-green': 'var(--border-neon-green)',
        'roulette-red': 'var(--roulette-red)',
        'roulette-black': 'var(--roulette-black)',
        'roulette-green': 'var(--roulette-green)',
        'accent-gold': 'var(--accent-gold)',
        'status-profit': 'var(--status-profit)',
        'status-loss': 'var(--status-loss)',
      },
      fontFamily: {
        sans: ['Inter', 'Montserrat', 'sans-serif'],
        felt: ['Impact', 'Arial Black', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

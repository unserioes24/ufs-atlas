/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Die Oberfläche lebt von einem sehr dunklen Blaugrün mit Cyan als
      // einziger Signalfarbe. Beides steht hier, damit es nicht in jeder
      // Komponente als Zahlenwert auftaucht.
      colors: {
        abgrund: '#061017',
        tiefe: '#0b1821',
      },
      boxShadow: {
        glow: '0 0 50px rgba(34, 211, 238, .12)',
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        floaty: 'floaty 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.vue'],
  theme: {
    extend: {
      animation: {
        'spin-fast': 'spin .5s linear infinite',
      }
    },
  },
  plugins: [],
  prefix: 'cwa-',
}

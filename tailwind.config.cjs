/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.vue', './playground/layouts/**/*.vue'],
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

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
  // todo: need to decide on this.. disabling to prevent duplicate preflight settings for website.. should the module preflight the css or just define its own...
  corePlugins: {
    preflight: false,
  },
  important: true
}

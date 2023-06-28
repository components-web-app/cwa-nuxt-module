import { Config } from 'tailwindcss'
import colors from 'tailwindcss/colors'

module.exports = {
  content: ['src/**/*.vue'],
  theme: {
    extend: {
      animation: {
        'spin-fast': 'spin .5s linear infinite'
      },
      colors: {
        dark: colors.stone['900'],
        light: colors.stone['100'],
        medium: colors.stone['500']
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')
  ],
  prefix: 'cwa-',
  important: true
} as Config

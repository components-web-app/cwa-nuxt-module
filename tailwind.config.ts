import { Config } from 'tailwindcss'
import colors from 'tailwindcss/colors'

module.exports = {
  content: ['src/**/*.vue'],
  theme: {
    colors: {
      stone: {
        100: colors.stone['100'],
        400: colors.stone['400'],
        900: colors.stone['900']
      },
      blue: {
        600: colors.blue['600']
      },
      indigo: {
        600: colors.indigo['600']
      },
      gray: {
        200: colors.gray['200'],
        300: colors.gray['300'],
        800: colors.gray['800'],
        900: colors.gray['900']
      },
      neutral: {
        400: colors.neutral['400'],
        600: colors.neutral['600'],
        800: colors.neutral['800'],
        900: colors.neutral['900']
      },
      white: colors.white,
      transparent: colors.transparent,
      orange: '#FFAA00',
      magenta: '#e30a6c',
      green: '#9CDD05'
    },
    extend: {
      animation: {
        'spin-fast': 'spin .5s linear infinite'
      },
      colors: {
        dark: colors.stone['900'],
        light: colors.stone['100'],
        medium: colors.stone['400']
      },
      backdropBlur: {
        xs: '3px'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')
  ],
  prefix: 'cwa-',
  important: true
} as Config

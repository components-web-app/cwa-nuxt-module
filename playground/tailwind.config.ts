import { Config } from 'tailwindcss'

module.exports = {
  content: [
    './cwa/**/*.{js,vue,ts}'
  ],
  plugins: [
    require('@tailwindcss/forms')
  ]
} as Config

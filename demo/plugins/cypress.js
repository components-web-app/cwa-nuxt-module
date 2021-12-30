const isCypress = process.client && typeof window.Cypress !== 'undefined'

export default function ({ app, isDev }) {
  if (isDev && isCypress) {
    window.nuxtApp = app
  }
}

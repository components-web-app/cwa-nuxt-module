const isCypress = process.client && typeof window.Cypress !== 'undefined'

export default function ({ app }) {
  if (isCypress) {
    window.nuxtApp = app
  }
}

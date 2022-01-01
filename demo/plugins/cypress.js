// DO NOT USE THIS PLUGIN IN A PRODUCTION APPLICATION
// IT IS EXTREMELY EASY FOR A USER TO MOCK THIS AND EXPOSE YOUR NUXT APPLICATION
const isCypress = process.client && typeof window.Cypress !== 'undefined'

export default function ({ app }) {
  if (isCypress && process.env.TESTING) {
    window.nuxtApp = app
  }
}

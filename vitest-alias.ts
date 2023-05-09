import { resolve } from 'path'

const r = (p: string) => resolve(__dirname, p)

export const alias: Record<string, string> = {
  '#app': r('./playground/node_modules/nuxt/dist/app'),
  '#build': r('./playground/.nuxt'),
  '@cwa/nuxt-module': r('./src')
}

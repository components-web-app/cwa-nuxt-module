import { createResolver } from '@nuxt/kit'
import { defineBuildConfig } from 'unbuild'

const { resolve } = createResolver(import.meta.url)

export default defineBuildConfig({
  // failOnWarn: false,
  alias: {
    '#cwa': resolve('./src'),
  },
})

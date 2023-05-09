import { defineConfig } from 'vitest/config'
import { alias } from './vitest-alias'

export default defineConfig({
  test: {
    coverage: {
      provider: 'c8',
      include: ['src/**'],
      exclude: ['src/templates/**', 'src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/*.d.ts'],
      all: true
    },
    deps: {
      inline: ['nuxt/dist']
    }
  },
  resolve: {
    alias,
  }
})

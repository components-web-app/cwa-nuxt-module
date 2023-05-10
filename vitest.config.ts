import { defineVitestConfig } from 'nuxt-vitest/config'

export default defineVitestConfig({
  test: {
    coverage: {
      provider: 'c8',
      include: ['src/**'],
      exclude: ['src/templates/**', 'src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/*.d.ts'],
      all: true
    }
  }
})

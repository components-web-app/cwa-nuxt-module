import { defineConfig } from 'vitest/config'
import NuxtVitest from 'vite-plugin-nuxt-test'

export default defineConfig({
  plugins: [NuxtVitest()],
  test: {
    coverage: {
      provider: 'c8',
      include: ['src/**'],
      exclude: ['src/templates/**', 'src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/*.d.ts'],
      all: true
    }
  }
})

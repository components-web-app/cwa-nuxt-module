import { defineVitestConfig } from 'nuxt-vitest/config'

export default defineVitestConfig({
  test: {
    coverage: {
      reportsDirectory: '../coverage',
      provider: 'c8',
      include: ['src/**'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/*.d.ts'],
      all: true
    },
    resolveSnapshotPath (path: string, extension: string) {
      return path + extension
    }
  }
})

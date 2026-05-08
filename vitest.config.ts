import { fileURLToPath } from 'node:url'
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    onConsoleLog: (l) => {
      return !l.includes('<Suspense> is an experimental feature')
    },
    environment: 'happy-dom', // or node or nuxt
    coverage: {
      reportsDirectory: './coverage',
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/*.d.ts', 'src/**/*.d.mts', 'src/**/*.md', 'src/**/*.json', 'src/**/.DS_Store'],
    },
    environmentOptions: {
      nuxt: {
        mock: {
          intersectionObserver: true,
          indexedDb: false,
        },
        rootDir: fileURLToPath(new URL('./playground/', import.meta.url)),
      },
    },
    resolveSnapshotPath(path: string, extension: string) {
      return path + extension
    },
    setupFiles: ['./setup.ts'],
    include: ['src/**/*.spec.ts'],
  },
})

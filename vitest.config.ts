import { fileURLToPath } from 'node:url'
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  plugins: [
    {
      name: 'cwa:vitest-keep-nuxt-link-component',
      configResolved(config) {
        const plugins = config.plugins as unknown as { name?: string }[]
        const index = plugins.findIndex(plugin => plugin?.name === 'nuxt:nuxt-link-client')
        if (index !== -1) {
          plugins.splice(index, 1)
        }
      },
    },
  ],
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
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts', 'playground/app/**/*.spec.ts'],
  },
})

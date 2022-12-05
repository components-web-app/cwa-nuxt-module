import { fileURLToPath } from 'url'
import { setup, useTestContext } from '@nuxt/test-utils-edge'
import { describe, test, expect } from 'vitest'
import CwaModule from './module'

describe.concurrent('Functional: Test modules are defined when Nuxt App is setup', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
    nuxtConfig: {
      modules: [
        CwaModule
      ],
      cwa: {
        apiUrl: 'https://localhost:8443',
        apiUrlBrowser: 'https://localhost:8443'
      }
    }
  })

  const context = useTestContext()

  test('Modules are required', () => {
    expect(context.nuxt).toBeDefined()
    if (!context.nuxt) {
      return
    }
    const requiredModules = Object.keys(context.nuxt.options._requiredModules)
    expect(requiredModules).toContain('@cwa/nuxt-module')
    expect(requiredModules).toContain('pinia')
  })
  test('Runtime is added to build transpile', () => {
    const runtimeDir = fileURLToPath(new URL('./runtime', import.meta.url))
    expect(context.nuxt?.options.build.transpile).toContain(runtimeDir)
  })
})

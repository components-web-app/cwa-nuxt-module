import { fileURLToPath } from 'url'
import { join } from 'path'
import { setup, useTestContext } from '@nuxt/test-utils'
import { describe, test, expect, vi } from 'vitest'
import * as nuxtKit from '@nuxt/kit'
import { NuxtModule } from '@nuxt/schema'
import CwaModule from './module'

vi.mock('@nuxt/kit', async () => {
  const module = await vi.importActual<typeof nuxtKit>('@nuxt/kit')
  const newModule = {
    ...module,
    defineNuxtModule: vi.fn(ops => module.defineNuxtModule(ops)),
    addPluginTemplate: vi.fn(module.addPluginTemplate)
  }
  return {
    ...newModule,
    default: module
  }
})

describe('Functional: Test modules are defined when Nuxt App is setup', async () => {
  // @ts-ignore
  const module: NuxtModule = CwaModule
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
    nuxtConfig: {
      modules: [
        module
      ],
      cwa: {
        apiUrl: 'https://localhost:8443',
        apiUrlBrowser: 'https://localhost:8443'
      }
    },
    server: true
  })
  const context = useTestContext()

  test('Test module setup with correct options', () => {
    expect(nuxtKit.defineNuxtModule).toHaveBeenCalledOnce()
    expect(nuxtKit.defineNuxtModule).toHaveBeenCalledWith(expect.objectContaining({
      defaults: {
        storeName: 'cwa'
      },
      meta: {
        name: '@cwa/nuxt-module',
        configKey: 'cwa',
        compatibility: {
          nuxt: '^3.0.0'
        }
      }
    }))
  })

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

  test('Plugins are added', () => {
    expect(nuxtKit.addPluginTemplate).toBeCalledTimes(1)
    expect(nuxtKit.addPluginTemplate).toBeCalledWith({
      src: fileURLToPath(new URL('./templates/plugin.template.ts', import.meta.url)),
      filename: join('cwa', 'cwa-plugin.ts'),
      options: {
        storeName: 'cwa',
        apiUrl: 'https://localhost:8443',
        apiUrlBrowser: 'https://localhost:8443'
      }
    })
  })

  test('css option is set', () => {
    expect(context.nuxt?.options.css).toContain(fileURLToPath(new URL('./runtime/templates/assets/main.css', import.meta.url)))
  })

  test.todo('Dynamic pages are added with the depth provided', () => {

  })

  // Todo: need a dummy API for this ands some pages to try rendering and testing - perhaps will do this with Cypress though
  // test('Load page', async () => {
  //   const html = await $fetch('/')
  //   console.log(html)
  // }, 20000)
})

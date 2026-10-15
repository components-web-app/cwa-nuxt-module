import { describe, expect, test, vi } from 'vitest'
import { computed, nextTick, reactive, ref } from 'vue'
import { createHooks } from 'hookable'
import plugin from './plugin-page-loading.client'

function setupApp(meta: Record<string, any> = {}) {
  const hooks = createHooks<Record<string, () => any>>()
  const progress = reactive({ resources: [] as string[], percent: 100 })
  const currentRoute = ref({ meta })
  const nuxtApp = {
    hook: hooks.hook,
    $router: { currentRoute },
    $cwa: { resources: { pageLoadProgress: computed(() => ({ ...progress, total: progress.resources.length, complete: 0 })) } },
  }
  plugin.setup(nuxtApp as never)
  const laterHandler = vi.fn()
  hooks.hook('page:loading:end', laterHandler)
  return { hooks, progress, currentRoute, laterHandler }
}

async function settle() {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('page loading plugin', () => {
  test('page:loading:end waits while a CWA page load runs, so the loading bar and the scroll to top wait for the new page (#396)', async () => {
    const { hooks, progress, laterHandler } = setupApp()
    progress.resources = ['/_/routes/a', '/_/pages/a']
    progress.percent = 50
    const ended = hooks.callHook('page:loading:end')
    await settle()
    expect(laterHandler).not.toHaveBeenCalled()
    progress.percent = 100
    await ended
    expect(laterHandler).toHaveBeenCalledOnce()
  })

  test('page:loading:end passes straight through when no CWA page load is running', async () => {
    const { hooks, laterHandler } = setupApp()
    await hooks.callHook('page:loading:end')
    expect(laterHandler).toHaveBeenCalledOnce()
  })

  test('a page with cwa.disabled in its meta is never held, even while a CWA fetch from the page left is still running', async () => {
    const { hooks, progress, laterHandler } = setupApp({ cwa: { disabled: true } })
    progress.resources = ['/_/routes/a']
    progress.percent = 0
    await hooks.callHook('page:loading:end')
    expect(laterHandler).toHaveBeenCalledOnce()
  })

  test('navigating to a page with cwa.disabled releases a held page:loading:end', async () => {
    const { hooks, progress, currentRoute, laterHandler } = setupApp()
    progress.resources = ['/_/routes/a']
    progress.percent = 0
    const ended = hooks.callHook('page:loading:end')
    await settle()
    expect(laterHandler).not.toHaveBeenCalled()
    currentRoute.value = { meta: { cwa: { disabled: true } } }
    await ended
    expect(laterHandler).toHaveBeenCalledOnce()
  })

  test('a failed CWA page load releases page:loading:end when its fetch ends, so the bar is never left stuck', async () => {
    const { hooks, progress, laterHandler } = setupApp()
    progress.resources = ['/_/routes/a', undefined as unknown as string]
    progress.percent = 50
    const ended = hooks.callHook('page:loading:end')
    await settle()
    expect(laterHandler).not.toHaveBeenCalled()
    progress.resources = []
    await ended
    expect(laterHandler).toHaveBeenCalledOnce()
  })

  test('a superseded navigation is released when the newer page load finishes', async () => {
    const { hooks, progress, laterHandler } = setupApp()
    progress.resources = ['/_/routes/a']
    progress.percent = 0
    const ended = hooks.callHook('page:loading:end')
    await settle()
    progress.resources = ['/_/routes/b', '/_/pages/b']
    progress.percent = 50
    await settle()
    expect(laterHandler).not.toHaveBeenCalled()
    progress.percent = 100
    await ended
    expect(laterHandler).toHaveBeenCalledOnce()
  })

  test('runs after the cwa plugin', () => {
    expect(plugin.dependsOn).toEqual(['cwa-plugin'])
  })
})

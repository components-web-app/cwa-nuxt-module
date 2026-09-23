// @vitest-environment nuxt
import { beforeAll, describe, expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick } from 'vue'
import type { Router } from 'vue-router'
import { useNuxtApp, useRouter } from '#imports'
import { NuxtPage } from '#components'

const Host = defineComponent({
  setup: () => () => h(NuxtPage),
})

async function settle() {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 150))
}

describe('#337 CWA page routes complete the Nuxt page lifecycle', () => {
  const events: string[] = []
  let router: Router

  beforeAll(async () => {
    const nuxtApp = useNuxtApp()
    router = useRouter()
    nuxtApp.hook('page:loading:end', () => {
      events.push('page:loading:end')
    })
    nuxtApp.hook('page:finish', () => {
      events.push('page:finish')
    })
    await router.push('/')
    await mountSuspended(Host)
    await settle()
  })

  async function navigate(path: string) {
    events.length = 0
    await router.push(path).catch(() => {})
    await settle()
    return [...events]
  }

  test('page:loading:end fires for a single-segment route, which the default scrollBehavior waits on', async () => {
    const fired = await navigate('/about')

    expect(fired).toContain('page:loading:end')
    expect(router.currentRoute.value.matched).toHaveLength(1)
  })

  test('page:loading:end fires for a nested multi-segment route', async () => {
    const fired = await navigate('/conference/programme')

    expect(fired).toContain('page:loading:end')
    expect(router.currentRoute.value.matched).toHaveLength(1)
  })

  test('the page component is never remounted between CWA routes, so a held page is not torn down (#256)', async () => {
    await navigate('/')

    expect(await navigate('/about')).not.toContain('page:finish')
    expect(await navigate('/conference/programme')).not.toContain('page:finish')
  })

  test('a URL deeper than pagesDepth matches no route', () => {
    expect(router.resolve('/a/b/c/d/e').matched).toHaveLength(0)
  })
})

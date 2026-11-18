// @vitest-environment nuxt
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { NuxtLayout, NuxtPage } from '#components'
import { useNuxtApp, useRouter } from '#imports'

beforeAll(async () => {
  await import('../pages/kit.vue')
}, 60_000)

afterEach(async () => {
  vi.restoreAllMocks()
  await useRouter().push('/')
})

const App = defineComponent(() => () => h(NuxtLayout, null, { default: () => h(NuxtPage) }))

describe('/kit runs without the page\'s own CWA', () => {
  test('no CWA route fetch runs, and the page has no CWA layout', async () => {
    const $cwa = useNuxtApp().$cwa
    const fetchRoute = vi.spyOn($cwa, 'fetchRoute')
    const router = useRouter()
    await router.push('/kit')
    expect(router.currentRoute.value.name).toBe('kit')
    expect(router.currentRoute.value.meta.cwa).toEqual({ disabled: true })
    expect(router.currentRoute.value.meta.layout).toBe(false)
    expect(fetchRoute).not.toHaveBeenCalled()
  })

  test('a click on a sample while editing never reaches the real resource manager or selects anything', async () => {
    const $cwa = useNuxtApp().$cwa
    const stack = $cwa.admin.resourceStackManager
    await useRouter().push('/kit')
    const wrapper = await mountSuspended(App, { route: '/kit', attachTo: document.body })
    expect(wrapper.find('#cwa-root-layout').exists()).toBe(false)
    $cwa.admin.toggleEdit(true)
    const sample = wrapper.find('[data-kit-field="input"] input')
    expect(sample.exists()).toBe(true)
    await sample.trigger('click')
    await sample.trigger('contextmenu')
    expect(stack.resourceStack.value).toEqual([])
    expect(stack.showManager.value).toBe(false)
    $cwa.admin.toggleEdit(false)
    wrapper.unmount()
  })
})

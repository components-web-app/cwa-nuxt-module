// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { consola } from 'consola'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useCwaToast } from '#cwa/composables/cwa-toast'

const nuxtApp = vi.hoisted(() => ({ current: {} as { vueApp: object, ssrContext?: object } }))
vi.mock('#app/nuxt', () => ({ useNuxtApp: () => nuxtApp.current }))

const toaster = vi.hoisted(() => ({ mount: vi.fn() }))
vi.mock('#cwa/admin/toaster', () => ({ mountToaster: toaster.mount }))

function freshApp(ssrContext?: object) {
  nuxtApp.current = { vueApp: {}, ssrContext }
  return nuxtApp.current
}

async function settle() {
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

afterEach(() => {
  toaster.mount.mockReset()
})

describe('useCwaToast (#457)', () => {
  test('loads and mounts the toaster on the first toast, once per app, and hands it every call in order', async () => {
    const app = freshApp()
    const mounted = { show: vi.fn(), dismiss: vi.fn() }
    toaster.mount.mockReturnValue(mounted)
    const calls: string[] = []
    mounted.show.mockImplementation(({ id }) => calls.push(`show ${id}`))
    mounted.dismiss.mockImplementation(id => calls.push(`dismiss ${id}`))

    const first = useCwaToast()
    const second = useCwaToast()
    first.show({ id: 'a', tone: 'success', title: 'Published' })
    first.dismiss('a')
    second.show({ id: 'b', tone: 'info', title: 'Updated' })

    expect(mounted.show).not.toHaveBeenCalled()
    await settle()

    expect(toaster.mount).toHaveBeenCalledTimes(1)
    expect(toaster.mount).toHaveBeenCalledWith(app.vueApp)
    expect(calls).toEqual(['show a', 'dismiss a', 'show b'])
    expect(mounted.show).toHaveBeenCalledWith({ id: 'a', tone: 'success', title: 'Published' })

    first.show({ id: 'c', tone: 'warning', title: 'Reconnected' })
    await settle()
    expect(toaster.mount).toHaveBeenCalledTimes(1)
    expect(calls.at(-1)).toBe('show c')
  })

  test('another app gets its own toaster', async () => {
    const one = freshApp()
    toaster.mount.mockReturnValue({ show: vi.fn(), dismiss: vi.fn() })
    useCwaToast().show({ tone: 'info', title: 'One' })
    await settle()
    const two = freshApp()
    useCwaToast().show({ tone: 'info', title: 'Two' })
    await settle()

    expect(toaster.mount.mock.calls.map(([app]) => app)).toEqual([one.vueApp, two.vueApp])
  })

  test('a component using it mounts the toaster when it mounts, so the live region is in the page before the first toast', async () => {
    const app = freshApp()
    const mounted = { show: vi.fn(), dismiss: vi.fn() }
    toaster.mount.mockReturnValue(mounted)
    const wrapper = mount(defineComponent({
      setup() {
        useCwaToast()
        return () => h('span')
      },
    }))
    await settle()

    expect(toaster.mount).toHaveBeenCalledTimes(1)
    expect(toaster.mount).toHaveBeenCalledWith(app.vueApp)
    expect(mounted.show).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  test('a component using it during a server render mounts nothing', async () => {
    freshApp({})
    mount(defineComponent({
      setup() {
        useCwaToast()
        return () => h('span')
      },
    })).unmount()
    await settle()

    expect(toaster.mount).not.toHaveBeenCalled()
  })

  test('dismissing before any toast was shown loads nothing', async () => {
    freshApp()
    useCwaToast().dismiss('a')
    await settle()

    expect(toaster.mount).not.toHaveBeenCalled()
  })

  test('does nothing during a server render', async () => {
    freshApp({})
    useCwaToast().show({ tone: 'error', title: 'Failed' })
    await settle()

    expect(toaster.mount).not.toHaveBeenCalled()
  })

  test('reads the app when called, so a toast shown after an await still reaches it', async () => {
    const app = freshApp()
    toaster.mount.mockReturnValue({ show: vi.fn(), dismiss: vi.fn() })
    const toast = useCwaToast()
    freshApp()
    toast.show({ tone: 'info', title: 'Later' })
    await settle()

    expect(toaster.mount).toHaveBeenCalledWith(app.vueApp)
  })

  test('a toaster that failed to mount is tried again on the next toast', async () => {
    freshApp()
    const mounted = { show: vi.fn(), dismiss: vi.fn() }
    const error = vi.spyOn(consola, 'error').mockImplementation(() => {})
    toaster.mount.mockImplementationOnce(() => {
      throw new Error('no container')
    }).mockReturnValue(mounted)

    const toast = useCwaToast()
    toast.show({ tone: 'info', title: 'Lost' })
    await settle()
    expect(error).toHaveBeenCalled()

    toast.show({ tone: 'info', title: 'Shown' })
    await settle()
    expect(toaster.mount).toHaveBeenCalledTimes(2)
    expect(mounted.show).toHaveBeenCalledWith({ tone: 'info', title: 'Shown' })
    error.mockRestore()
  })
})

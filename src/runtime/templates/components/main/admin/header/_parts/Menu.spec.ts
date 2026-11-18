// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import Menu from './Menu.vue'
import Hamburger from '../../../../ui/Hamburger.vue'
import { axe } from '../../../../../../../../test/utils/axe'

const route = vi.hoisted(() => ({ path: '/' }))
vi.mock('#app/composables/router', async () => {
  const { reactive } = await import('vue')
  const current = reactive(route)
  return { useRoute: () => current }
})
vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    config: { siteName: 'Site' },
    auth: { user: undefined, signOut: vi.fn() },
    navigationDisabled: false,
  }),
}))

const LinkStub = defineComponent({
  props: { to: { type: [String, Object], default: '#' } },
  setup(props, { slots }) {
    return () => h('a', { href: typeof props.to === 'string' ? props.to : '/route' }, slots.default?.())
  },
})

function mountMenu() {
  return mount(Menu, {
    attachTo: document.body,
    global: {
      components: { CwaUiHamburger: Hamburger },
      stubs: { Transition: false, CwaLink: LinkStub, NuxtLink: LinkStub },
    },
  })
}

let wrapper: ReturnType<typeof mountMenu> | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('the header menu is operable from the keyboard', () => {
  test('the toggle is a button naming the panel it controls and whether it is open', async () => {
    wrapper = mountMenu()
    const toggle = wrapper.get('button')
    expect(toggle.attributes('type')).toBe('button')
    expect(toggle.text()).toBe('Menu')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    const panel = document.getElementById(toggle.attributes('aria-controls')!)
    expect(panel).not.toBeNull()
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(await axe(document.body.innerHTML)).toHaveNoViolations()
  })

  test('opening it moves focus to its first link', async () => {
    wrapper = mountMenu()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(document.activeElement?.textContent?.trim()).toBe('Layouts')
  })

  test('Escape closes it and returns focus to the toggle', async () => {
    wrapper = mountMenu()
    const toggle = wrapper.get('button')
    await toggle.trigger('click')
    await flushPromises()
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle.element)
  })

  test('tabbing out of it closes it, and moving focus within it does not', async () => {
    wrapper = mountMenu()
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    const toggle = wrapper.get('button')
    await toggle.trigger('click')
    await flushPromises()
    const links = wrapper.findAll('a')
    links[0]!.element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: links[1]!.element }))
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('true')
    links[1]!.element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }))
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })
})

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
const roles = vi.hoisted(() => ({ list: ['ROLE_ADMIN', 'ROLE_CMS_ADMIN', 'ROLE_USER'] }))
vi.mock('#cwa/composables/cwa', async () => {
  const { computed } = await import('vue')
  return {
    useCwa: () => ({
      config: { siteName: 'Site' },
      auth: { user: undefined, signOut: vi.fn(), isAdmin: computed(() => roles.list.includes('ROLE_CMS_ADMIN')), hasRole: (role: string) => roles.list.includes(role) },
      navigationDisabled: false,
    }),
  }
})
vi.mock('#build/cwa-extension-menu', () => ({
  extensionMenu: [
    { label: 'Orders', to: { name: '_cwa-orders' }, role: 'ROLE_ADMIN' },
    { label: 'Reports', to: { name: '_cwa-reports' }, role: 'ROLE_SHOP_ACCOUNTS' },
  ],
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

function nextTask() {
  return new Promise(resolve => setTimeout(resolve))
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

  test('a click outside closes it, and a click on the toggle while open closes it once, never reopening it', async () => {
    wrapper = mountMenu()
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    const toggle = wrapper.get('button')
    await toggle.trigger('click')
    await nextTask()
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('false')

    await nextTask()
    await toggle.trigger('click')
    await nextTask()
    toggle.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await toggle.trigger('click')
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })

  test('a click on the toggle is never taken as a click outside, which in a browser closed the menu before the toggle reopened it', async () => {
    wrapper = mountMenu()
    const toggle = wrapper.get('button')
    await toggle.trigger('click')
    await nextTask()
    toggle.element.addEventListener('click', event => event.stopImmediatePropagation(), { capture: true })

    toggle.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await toggle.trigger('click')
    await flushPromises()

    expect(toggle.attributes('aria-expanded')).toBe('true')
  })
})

describe('the narrow admin roles (bundle #611)', () => {
  afterEach(() => {
    roles.list = ['ROLE_ADMIN', 'ROLE_CMS_ADMIN', 'ROLE_USER']
  })

  async function shownLinks() {
    wrapper = mountMenu()
    await wrapper.get('button').trigger('click')
    return wrapper.findAll('a').map(link => link.text().trim()).filter(Boolean)
  }

  test('a content admin who is not a user admin gets the content areas and site settings, and no Users', async () => {
    roles.list = ['ROLE_CMS_ADMIN', 'ROLE_USER']
    const links = await shownLinks()
    expect(links).toEqual(expect.arrayContaining(['Layouts', 'Pages', 'Data', 'Routes', 'Site settings']))
    expect(links).not.toContain('Users')
  })

  test('a user admin who cannot edit content gets Users and no content areas or site settings', async () => {
    roles.list = ['ROLE_USER_ADMIN', 'ROLE_USER']
    const links = await shownLinks()
    expect(links).toContain('Users')
    for (const label of ['Layouts', 'Pages', 'Data', 'Routes', 'Site settings']) {
      expect(links).not.toContain(label)
    }
  })

  test('a super admin, reaching both, gets both', async () => {
    roles.list = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER_ADMIN', 'ROLE_CMS_ADMIN', 'ROLE_USER']
    const links = await shownLinks()
    expect(links).toEqual(expect.arrayContaining(['Layouts', 'Pages', 'Data', 'Routes', 'Site settings', 'Users']))
  })
})

describe('extension admin pages', () => {
  afterEach(() => {
    roles.list = ['ROLE_ADMIN', 'ROLE_CMS_ADMIN', 'ROLE_USER']
  })

  test('lists the pages extensions put in the menu that the user\'s roles open', async () => {
    roles.list = ['ROLE_ADMIN', 'ROLE_SHOP_ACCOUNTS']
    wrapper = mountMenu()
    await wrapper.get('button').trigger('click')

    const section = wrapper.findAll('h3').find(heading => heading.text() === 'Extensions')!.element.parentElement!
    expect([...section.querySelectorAll('li')].map(item => item.textContent?.trim())).toEqual(['Orders', 'Reports'])
  })

  test('leaves out a page whose role the user lacks', async () => {
    wrapper = mountMenu()
    await wrapper.get('button').trigger('click')

    const section = wrapper.findAll('h3').find(heading => heading.text() === 'Extensions')!.element.parentElement!
    expect([...section.querySelectorAll('li')].map(item => item.textContent?.trim())).toEqual(['Orders'])
  })

  test('shows no Extensions heading when the user can open none of them', async () => {
    roles.list = ['ROLE_CMS_ADMIN']
    wrapper = mountMenu()
    await wrapper.get('button').trigger('click')

    expect(wrapper.findAll('h3').map(heading => heading.text())).not.toContain('Extensions')
  })
})

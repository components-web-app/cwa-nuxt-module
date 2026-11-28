// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import Menu from './Menu.vue'
import Hamburger from '../../../../ui/Hamburger.vue'
import MenuPrimaryLink from './MenuPrimaryLink.vue'
import { drawsFocusRing, fadesFocusRingFromText } from '../../../../../../../../test/utils/focus-ring'
import { axe } from '../../../../../../../../test/utils/axe'

const route = vi.hoisted(() => ({ path: '/' }))
vi.mock('#app/composables/router', async () => {
  const { reactive } = await import('vue')
  const current = reactive(route)
  return { useRoute: () => current }
})
const roles = vi.hoisted(() => ({ list: ['ROLE_ADMIN', 'ROLE_CMS_ADMIN', 'ROLE_USER'] }))
const account = vi.hoisted(() => ({ user: undefined as any, signOut: vi.fn() }))
const docs = vi.hoisted(() => ({
  withPageData: { pageDataMetadata: { member: [{ resourceClass: 'App\\Entity\\AbstractPageData' }, { resourceClass: 'App\\Entity\\BlogArticleData' }] } },
  load: vi.fn(),
}))
vi.mock('#cwa/composables/cwa', async () => {
  const { computed } = await import('vue')
  return {
    useCwa: () => ({
      config: { siteName: 'Site' },
      auth: { get user() { return account.user }, signOut: account.signOut, isAdmin: computed(() => roles.list.includes('ROLE_CMS_ADMIN')), hasRole: (role: string) => roles.list.includes(role) },
      getApiDocumentation: docs.load,
      navigationDisabled: false,
    }),
  }
})
const extensions = vi.hoisted(() => ({ areas: [] as any[], topBarDefault: undefined as string[] | undefined }))
vi.mock('#build/cwa-extension-areas', () => ({
  get extensionAreas() { return extensions.areas },
}))
vi.mock('#build/cwa-admin-top-bar', () => ({
  get topBarDefault() { return extensions.topBarDefault },
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

beforeEach(() => {
  docs.load.mockResolvedValue(docs.withPageData)
})

afterEach(() => {
  roles.list = ['ROLE_ADMIN', 'ROLE_CMS_ADMIN', 'ROLE_USER']
  extensions.areas = []
  extensions.topBarDefault = undefined
  account.user = undefined
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

async function openMenu() {
  wrapper = mountMenu()
  await wrapper.get('button').trigger('click')
  await flushPromises()
  return wrapper
}

function quickLinks(menu: NonNullable<typeof wrapper>) {
  return menu.findAllComponents(MenuPrimaryLink).map(link => ({ label: link.props('label'), to: link.props('to') }))
}

const shop = { segment: 'shop', label: 'Shop', icon: '<svg id="shop-icon"></svg>', topBar: true, pages: [{ path: '', label: 'Orders', role: 'ROLE_ADMIN' }] }

describe('the quick links (#518)', () => {
  test('lists the bar\'s quick links in the bar\'s order, then Dashboard', async () => {
    extensions.areas = [shop]
    extensions.topBarDefault = ['routes', 'ext:shop', 'pages']
    const menu = await openMenu()

    expect(quickLinks(menu)).toStrictEqual([
      { label: 'Routes', to: '/_cwa/routes' },
      { label: 'Shop', to: { name: '_cwa-shop' } },
      { label: 'Pages', to: '/_cwa/pages' },
      { label: 'Dashboard', to: '/_cwa' },
    ])
    expect(menu.findAllComponents(MenuPrimaryLink).map(link => link.get('a').attributes('href'))).toStrictEqual(['/_cwa/routes', '/route', '/_cwa/pages', '/_cwa'])
  })

  test('follows the admin\'s own list over the developer\'s', async () => {
    extensions.topBarDefault = ['routes']
    account.user = { '@id': '/_/users/admin', 'adminPreferences': { topBar: ['data', 'layouts'] } }
    const menu = await openMenu()

    expect(quickLinks(menu).map(link => link.label)).toStrictEqual(['Data', 'Layouts', 'Dashboard'])
  })

  test('an extension\'s icon is its SVG inside a hidden span, and every built-in icon is hidden', async () => {
    extensions.areas = [shop]
    extensions.topBarDefault = ['layouts', 'ext:shop']
    const menu = await openMenu()
    const links = menu.findAllComponents(MenuPrimaryLink)

    expect(links[1]!.get('#shop-icon').element.parentElement!.getAttribute('aria-hidden')).toBe('true')
    for (const link of [links[0]!, links[2]!]) {
      const svg = link.get('svg')
      expect(svg.element.closest('[aria-hidden="true"]')).not.toBeNull()
    }
    expect(links[2]!.find('svg path').exists()).toBe(true)
  })

  test('has a Quick links heading over them', async () => {
    const menu = await openMenu()

    expect(menu.findAll('h3').map(heading => heading.text())).toContain('Quick links')
  })

  test('with an empty list only Dashboard is left, with no heading', async () => {
    account.user = { '@id': '/_/users/admin', 'adminPreferences': { topBar: [] } }
    const menu = await openMenu()

    expect(quickLinks(menu).map(link => link.label)).toStrictEqual(['Dashboard'])
    expect(menu.findAll('h3').map(heading => heading.text())).not.toContain('Quick links')
    expect(menu.findAll('ul').every(list => list.findAll('li').length > 0)).toBe(true)
    expect(await axe(document.body.innerHTML)).toHaveNoViolations()
  })

  test('a content admin who is not a user admin gets the content areas and no Users', async () => {
    roles.list = ['ROLE_CMS_ADMIN', 'ROLE_USER']
    const labels = quickLinks(await openMenu()).map(link => link.label)
    expect(labels).toStrictEqual(['Layouts', 'Pages', 'Data', 'Routes', 'Dashboard'])
  })

  test('a user admin who cannot edit content gets Users and no content areas', async () => {
    roles.list = ['ROLE_USER_ADMIN', 'ROLE_USER']
    const labels = quickLinks(await openMenu()).map(link => link.label)
    expect(labels).toStrictEqual(['Users', 'Dashboard'])
  })

  test('a super admin, reaching both, gets both', async () => {
    roles.list = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER_ADMIN', 'ROLE_CMS_ADMIN', 'ROLE_USER']
    const labels = quickLinks(await openMenu()).map(link => link.label)
    expect(labels).toStrictEqual(['Layouts', 'Pages', 'Data', 'Routes', 'Users', 'Dashboard'])
  })
})

describe('the menu\'s other column (#518)', () => {
  test('Site settings, Extensions and About the CWA have moved out of it', async () => {
    extensions.areas = [shop]
    const menu = await openMenu()
    const text = menu.text()

    for (const gone of ['Site settings', 'Extensions', 'About the CWA']) {
      expect(text).not.toContain(gone)
    }
    expect(menu.findAll('h3').map(heading => heading.text())).not.toContain('CWA')
  })

  test.each([
    [['ROLE_ADMIN']],
    [['ROLE_ADMIN', 'ROLE_CMS_ADMIN', 'ROLE_USER']],
    [['ROLE_ADMIN', 'ROLE_USER_ADMIN']],
  ])('Account links any admin (%j) to their account page', async (list) => {
    roles.list = list
    const menu = await openMenu()

    const link = menu.findAllComponents(LinkStub).find(candidate => candidate.text() === 'My account')
    expect(link?.props('to')).toStrictEqual({ name: '_cwa-account' })
  })

  test('Sign out is a button that signs out, never a link', async () => {
    const menu = await openMenu()
    const signOut = menu.findAll('button').find(button => button.text() === 'Sign out')!

    expect(signOut.attributes('type')).toBe('button')
    expect(menu.findAll('a').map(link => link.text().trim())).not.toContain('Sign out')
    await signOut.trigger('click')
    expect(account.signOut).toHaveBeenCalledTimes(1)
  })
})

describe('the menu is accessible and touch friendly (#518)', () => {
  test('its panel is a navigation landmark named Admin menu', async () => {
    const menu = await openMenu()
    const panel = document.getElementById(menu.get('button').attributes('aria-controls')!)!

    expect(panel.closest('nav')?.getAttribute('aria-label')).toBe('Admin menu')
    expect(panel.querySelectorAll('a, button').length).toBeGreaterThan(0)
  })

  test('every link and button in it draws a focus ring, never fading it in from the text colour, and is a hit area tall on touch', async () => {
    const menu = await openMenu()
    const panel = document.getElementById(menu.get('button').attributes('aria-controls')!)!
    const controls = [...panel.querySelectorAll('a, button')]

    expect(controls.length).toBe(7)
    for (const control of controls) {
      const classes = [...control.classList]
      expect(drawsFocusRing(classes)).toBe(true)
      expect(fadesFocusRingFromText(classes)).toBe(false)
      expect(classes).toContain('cwa:pointer-coarse:min-h-hit')
    }
  })

  test('stacks its columns below sm, where two do not fit', async () => {
    const menu = await openMenu()
    const columns = menu.get('[data-testid="menu-columns"]').classes()

    expect(columns).toEqual(expect.arrayContaining(['cwa:flex-col', 'cwa:sm:flex-row']))
  })

  test('a route change closes it', async () => {
    const { useRoute } = await import('#app/composables/router')
    const current = useRoute()
    const menu = await openMenu()
    current.path = '/elsewhere'
    await flushPromises()

    expect(menu.get('button').attributes('aria-expanded')).toBe('false')
    current.path = '/'
  })
})

describe('the Data link', () => {
  test('shows when the API docs list page data classes', async () => {
    wrapper = mountMenu()
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('a').map(link => link.text().trim())).toContain('Data')
  })

  test.each([
    ['list only the abstract class', { pageDataMetadata: { member: [{ resourceClass: 'App\\Entity\\AbstractPageData' }] } }],
    ['list none', {}],
    ['fail to load', undefined],
  ])('is hidden when the API docs %s', async (_, loaded) => {
    docs.load.mockResolvedValue(loaded)
    wrapper = mountMenu()
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('a').map(link => link.text().trim())).not.toContain('Data')
    expect(wrapper.findAll('a').map(link => link.text().trim())).toContain('Pages')
  })

  test('the panel shows only once the docs have decided it, so the menu never jumps, and they are read once', async () => {
    let resolve: (value: unknown) => void = () => undefined
    docs.load.mockReturnValue(new Promise((done) => {
      resolve = done
    }))
    wrapper = mountMenu()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    const panel = document.getElementById(wrapper.get('button').attributes('aria-controls')!)!

    expect(panel.style.display).toBe('none')
    resolve(docs.withPageData)
    await flushPromises()
    expect(panel.style.display).toBe('')
    expect(document.activeElement?.textContent?.trim()).toBe('Layouts')

    await wrapper.get('button').trigger('click')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(docs.load).toHaveBeenCalledTimes(1)
  })
})

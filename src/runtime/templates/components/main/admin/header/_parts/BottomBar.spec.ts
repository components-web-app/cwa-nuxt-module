// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { axe } from '../../../../../../../../test/utils/axe'
import BottomBar from './BottomBar.vue'
import type Cwa from '#cwa/cwa'
import * as cwaComposable from '#cwa/composables/cwa'

enableAutoUnmount(afterEach)

const state = vi.hoisted(() => ({
  areas: [] as any[],
  topBarDefault: undefined as string[] | undefined,
  hasPageData: true as boolean | Promise<boolean>,
}))

vi.mock('#build/cwa-extension-areas', () => ({
  get extensionAreas() { return state.areas },
}))

vi.mock('#build/cwa-admin-top-bar', () => ({
  get topBarDefault() { return state.topBarDefault },
}))

const hasPageDataTypes = vi.hoisted(() => vi.fn())
vi.mock('#cwa/admin/page-data-presence', () => ({ hasPageDataTypes }))

const route = reactive({ path: '/_cwa' })
const resolve = vi.fn((to: string | { name: string }) => ({ path: typeof to === 'string' ? to : `/_cwa/${to.name.replace(/^_cwa-/, '')}` }))
mockNuxtImport('useRoute', () => () => route)
mockNuxtImport('useRouter', () => () => ({ resolve }))

const navigated = vi.fn()
const NuxtLink = {
  name: 'NuxtLink',
  props: ['to'],
  setup(props: { to: unknown }) {
    return { href: computed(() => typeof props.to === 'string' ? props.to : JSON.stringify(props.to)), navigate: () => navigated(props.to) }
  },
  template: '<a :href="href" @click.prevent="navigate"><slot /></a>',
}

const SHOP_ICON = '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z" /></svg>'
const shop = { segment: 'shop', label: 'Shop', icon: SHOP_ICON, pages: [{ path: '', label: 'Orders', role: 'ROLE_ADMIN' }] }

function mockCwa({ roles = ['ROLE_ADMIN', 'ROLE_CMS_ADMIN', 'ROLE_USER_ADMIN'], topBar }: { roles?: string[], topBar?: string[] } = {}) {
  const cwa = {
    auth: { user: topBar ? { adminPreferences: { topBar } } : {}, hasRole: (role: string) => roles.includes(role) },
  } as unknown as Cwa
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => cwa)
  return cwa
}

async function mountBar() {
  const wrapper = mount(BottomBar, { attachTo: document.body, global: { stubs: { NuxtLink } } })
  await flushPromises()
  return wrapper
}

function tabs(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('nav > ul > li > *')
}

function tabLabels(wrapper: ReturnType<typeof mount>) {
  return tabs(wrapper).map(tab => tab.text())
}

function sheet() {
  return document.querySelector<HTMLElement>('[data-testid="admin-more-sheet"]')
}

async function openMore(wrapper: ReturnType<typeof mount>) {
  const more = wrapper.find<HTMLButtonElement>('[data-testid="admin-bottom-bar-more"]')
  more.element.focus()
  await more.trigger('click')
  await flushPromises()
  return more.element
}

describe('BottomBar (#518)', () => {
  beforeEach(() => {
    state.areas = []
    state.topBarDefault = undefined
    hasPageDataTypes.mockImplementation(async () => true)
    route.path = '/_cwa'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('is a phone-only bar fixed to the bottom, padded for the home indicator, in an Admin navigation landmark on the kit\'s dark surface', async () => {
    mockCwa()
    const wrapper = await mountBar()

    const nav = wrapper.find('nav')
    expect(nav.attributes('aria-label')).toBe('Admin')
    for (const look of ['cwa:sm:hidden', 'cwa:fixed', 'cwa:inset-x-0', 'cwa:bottom-0', 'cwa:pb-[env(safe-area-inset-bottom)]', 'cwa:bg-surface', 'cwa:border-t', 'cwa:border-line']) {
      expect(nav.classes()).toContain(look)
    }
  })

  test('shows Dashboard first, then the first three quick links, each a 56px target, roomier than a 44px hit area as a native tab bar is, with a hidden icon over a label that truncates when long', async () => {
    state.areas = [shop]
    mockCwa({ topBar: ['ext:shop', 'pages', 'routes', 'users'] })
    const wrapper = await mountBar()

    expect(tabLabels(wrapper)).toEqual(['Dashboard', 'Shop', 'Pages', 'Routes', 'More'])
    expect(tabs(wrapper).slice(0, 4).map(tab => tab.attributes('href'))).toEqual(['/_cwa', JSON.stringify({ name: '_cwa-shop' }), '/_cwa/pages', '/_cwa/routes'])
    for (const tab of tabs(wrapper)) {
      expect(tab.classes()).toContain('cwa:h-14')
      expect(tab.find('svg').exists()).toBe(true)
      expect(tab.find('svg').element.closest('[aria-hidden="true"]')).not.toBeNull()
      expect(tab.find('[data-testid="admin-bottom-bar-label"]').classes()).toContain('cwa:truncate')
    }
    expect(tabs(wrapper)[1]!.html()).toContain('M0 0h24v24H0z')
  })

  test('leaves Data out until the API says there are page data types', async () => {
    let answer!: (found: boolean) => void
    hasPageDataTypes.mockImplementation(() => new Promise<boolean>((done) => {
      answer = done
    }))
    mockCwa()
    const wrapper = await mountBar()

    expect(tabLabels(wrapper)).toEqual(['Dashboard', 'Layouts', 'Pages', 'Routes', 'More'])
    answer(true)
    await flushPromises()
    expect(tabLabels(wrapper)).toEqual(['Dashboard', 'Layouts', 'Pages', 'Data', 'More'])
  })

  test.each([
    ['/_cwa', 'Dashboard'],
    ['/_cwa/pages', 'Pages'],
    ['/_cwa/pages/abc', 'Pages'],
    ['/_cwa/shop/orders', 'Shop'],
    ['/_cwa/settings', undefined],
  ])('at %s marks %s as the current page, and nothing else', async (path, current) => {
    state.areas = [shop]
    route.path = path
    mockCwa({ topBar: ['pages', 'ext:shop'] })
    const wrapper = await mountBar()

    expect(tabs(wrapper).filter(tab => tab.attributes('aria-current') === 'page').map(tab => tab.text())).toEqual(current ? [current] : [])
  })

  test('has no More with three quick links or fewer', async () => {
    mockCwa({ topBar: ['pages', 'routes', 'users'] })
    const wrapper = await mountBar()

    expect(tabLabels(wrapper)).toEqual(['Dashboard', 'Pages', 'Routes', 'Users'])
    expect(wrapper.find('[data-testid="admin-bottom-bar-more"]').exists()).toBe(false)
  })

  test('More opens a bottom sheet listing the rest as links, with icons', async () => {
    state.areas = [shop]
    mockCwa({ topBar: ['pages', 'routes', 'users', 'layouts', 'ext:shop'] })
    const wrapper = await mountBar()
    const more = wrapper.find('[data-testid="admin-bottom-bar-more"]')
    expect(more.attributes('aria-haspopup')).toBe('dialog')
    expect(more.attributes('aria-expanded')).toBe('false')
    expect(more.find('svg').element.closest('[aria-hidden="true"]')).not.toBeNull()

    await openMore(wrapper)

    expect(more.attributes('aria-expanded')).toBe('true')
    const links = [...sheet()!.querySelectorAll('a')]
    expect(links.map(link => link.textContent!.trim())).toEqual(['Layouts', 'Shop'])
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/_cwa/layouts', JSON.stringify({ name: '_cwa-shop' })])
    for (const link of links) {
      expect(link.querySelector('svg')!.closest('[aria-hidden="true"]')).not.toBeNull()
      expect(link.className).toContain('cwa:min-h-hit')
    }
    expect(document.activeElement).toBe(links[0])
  })

  test('choosing a link in the sheet navigates to it and closes the sheet', async () => {
    mockCwa({ topBar: ['pages', 'routes', 'users', 'layouts'] })
    const wrapper = await mountBar()
    await openMore(wrapper)

    sheet()!.querySelector('a')!.click()
    await flushPromises()

    expect(navigated).toHaveBeenCalledWith('/_cwa/layouts')
    expect(sheet()).toBeNull()
    expect(wrapper.find('[data-testid="admin-bottom-bar-more"]').attributes('aria-expanded')).toBe('false')
  })

  test.each([
    ['Escape', () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))],
    ['a tap on the scrim', () => document.querySelector<HTMLElement>('[data-testid="admin-more-sheet-scrim"]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))],
  ])('%s closes the sheet and returns focus to More', async (_, act) => {
    mockCwa({ topBar: ['pages', 'routes', 'users', 'layouts'] })
    const wrapper = await mountBar()
    const more = await openMore(wrapper)
    await new Promise(resolve => setTimeout(resolve))

    act()
    await flushPromises()

    expect(sheet()).toBeNull()
    expect(navigated).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(more)
  })

  test('has no axe violations, closed and with the sheet open', async () => {
    state.areas = [shop]
    route.path = '/_cwa/pages'
    mockCwa({ topBar: ['pages', 'routes', 'users', 'layouts', 'ext:shop'] })
    const wrapper = await mountBar()

    expect(await axe(wrapper.element)).toHaveNoViolations()
    await openMore(wrapper)
    expect(await axe(sheet()!)).toHaveNoViolations()
  })
})

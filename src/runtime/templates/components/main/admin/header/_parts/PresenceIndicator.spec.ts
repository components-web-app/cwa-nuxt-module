// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Router } from 'vue-router'
import PresenceIndicator from './PresenceIndicator.vue'
import { navigateTo } from '#app/composables/router'
import * as cwaComposable from '#cwa/composables/cwa'
import { Presence, presenceColour } from '#cwa/admin/presence'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import type Cwa from '#cwa/cwa'

vi.mock('#app/composables/router', () => ({
  navigateTo: vi.fn(),
  useRouter: () => ({
    resolve: (location: { path?: string, name?: string, params?: Record<string, string>, query?: Record<string, string> }) => ({
      href: `/base${location.path ?? `/${location.name}/${Object.values(location.params ?? {}).join('/')}`}?${new URLSearchParams(location.query).toString()}`,
    }),
  }),
}))

const HOME = '/_/pages/home'
const ABOUT = '/page_data/blog/about'
const CONTACT = '/_/pages/contact'
const ids = ['0a1b2c3d-1111-4aaa-8bbb-000000000001', '0a1b2c3d-1111-4aaa-8bbb-000000000002', '0a1b2c3d-1111-4aaa-8bbb-000000000003', '0a1b2c3d-1111-4aaa-8bbb-000000000004']
const SAM = { id: '/users/sam', name: 'Sam Smith' }
const ALEX = { id: '/users/alex', name: 'Alex' }
const JO = { id: '/users/jo', name: 'Jo Bloggs' }

let presence: Presence | undefined
const order: string[] = []
const mounted: { unmount: () => void }[] = []
const flush = vi.fn(async () => {
  await Promise.resolve()
  order.push('flush')
})

function mockCwa(byId: Record<string, Record<string, unknown>> = {}) {
  const state = reactive({ byId })
  const cwa = {
    apiUrlBase: 'https://api.test',
    cwaFetch: { fetch: vi.fn().mockResolvedValue(undefined) },
    resourcesConfig: { HtmlContent: { name: 'Rich text' } },
    resources: {
      displayPageIri: computed(() => HOME),
      pageDataIriOf: () => computed(() => undefined),
      getResource: (iri: string) => computed(() => state.byId[iri] ? { data: state.byId[iri] } : undefined),
    },
    resourcesManager: {
      pendingUpdates: new Map([['/component/html_contents/c1', new Set([flush])]]),
    },
    admin: { resourceStackManager: { currentIri: computed(() => undefined), getClosestStackItemByType: () => undefined } },
  }
  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue(cwa as unknown as Cwa)
  setActivePinia(createPinia())
  presence = new Presence(cwa as unknown as Cwa, new ResourcesStore('test').useStore(), { currentRoute: computed(() => ({ path: '/', meta: {} })) } as unknown as Router, '0a1b2c3d-1111-4aaa-8bbb-00000000000f')
  return cwa
}

function arrive(clientId: string, user: { id: string, name: string }, data: Record<string, unknown>) {
  presence!.receive({ '@type': 'CwaRealtimeEvent', 'v': 1, clientId, user, 'event': 'presence', 'data': { v: 1, state: 'viewing', page: HOME, ...data }, 'sentAt': '2026-10-21T10:00:00Z', 'expiresAt': '2026-10-21T10:00:45Z' })
}

async function mountIndicator() {
  const wrapper = mount(PresenceIndicator, { attachTo: document.body })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

async function openList() {
  const wrapper = await mountIndicator()
  await wrapper.get('[data-testid="presence-indicator"]').trigger('click')
  await flushPromises()
  const list = document.body.querySelector<HTMLElement>('[data-testid="presence-list"]')
  const rows = [...(list?.querySelectorAll<HTMLElement>('[data-testid="presence-row"]') ?? [])]
  return { wrapper, list, rows }
}

function text(element: Element | undefined) {
  return element?.textContent?.replace(/\s+/g, ' ').trim()
}

function texts(element: Element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const found: string[] = []
  while (walker.nextNode()) {
    const value = walker.currentNode.textContent?.trim()
    if (value) {
      found.push(value)
    }
  }
  return found.join(' ')
}

beforeEach(() => {
  order.length = 0
  vi.mocked(navigateTo).mockImplementation(async () => {
    order.push('navigate')
  })
})

afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount())
  presence?.stop()
  presence = undefined
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('PresenceIndicator (#429)', () => {
  test('renders nothing while presence is not running', async () => {
    mockCwa()
    arrive(ids[0]!, SAM, {})
    const wrapper = await mountIndicator()

    expect(wrapper.find('[data-testid="presence-indicator"]').exists()).toBe(false)
  })

  test('renders nothing when nobody else is here', async () => {
    mockCwa()
    presence!.start(true)
    const wrapper = await mountIndicator()

    expect(wrapper.find('[data-testid="presence-indicator"]').exists()).toBe(false)
  })

  test('one avatar per person on this page, in their colour, with a tab count for someone in two tabs', async () => {
    mockCwa()
    presence!.start(true)
    arrive(ids[0]!, SAM, {})
    arrive(ids[1]!, SAM, {})
    arrive(ids[2]!, ALEX, {})
    const wrapper = await mountIndicator()

    const avatars = wrapper.findAll('[data-testid="presence-avatar"]')
    expect(avatars.map(avatar => text(avatar.element))).toStrictEqual(['SS2', 'A'])
    expect(avatars[0]!.attributes('style')).toContain(presenceColour(SAM.id))
    expect(avatars[0]!.attributes('title')).toBe('Sam Smith · 2 tabs')
    expect(avatars[1]!.attributes('title')).toBe('Alex')
  })

  test('people on other pages are counted once each as "+N elsewhere"', async () => {
    mockCwa()
    presence!.start(true)
    arrive(ids[0]!, SAM, { page: ABOUT })
    arrive(ids[1]!, SAM, { page: CONTACT })
    arrive(ids[2]!, JO, { page: ABOUT })
    const wrapper = await mountIndicator()

    expect(wrapper.findAll('[data-testid="presence-avatar"]')).toHaveLength(0)
    expect(text(wrapper.get('[data-testid="presence-elsewhere"]').element)).toBe('+2 elsewhere')
  })

  test('someone with a tab here and another elsewhere has an avatar and is not counted again elsewhere', async () => {
    mockCwa()
    presence!.start(true)
    arrive(ids[0]!, SAM, {})
    arrive(ids[1]!, SAM, { page: ABOUT })
    arrive(ids[2]!, JO, { page: ABOUT })
    const wrapper = await mountIndicator()

    expect(wrapper.findAll('[data-testid="presence-avatar"]').map(avatar => text(avatar.element))).toStrictEqual(['SS'])
    expect(text(wrapper.get('[data-testid="presence-elsewhere"]').element)).toBe('+1 elsewhere')
  })

  test('the trigger is named for screen readers by who is here and how many are elsewhere', async () => {
    mockCwa()
    presence!.start(true)
    arrive(ids[0]!, SAM, {})
    arrive(ids[1]!, SAM, {})
    arrive(ids[2]!, ALEX, {})
    arrive(ids[3]!, JO, { page: ABOUT })
    const wrapper = await mountIndicator()

    expect(wrapper.get('[data-testid="presence-indicator"]').attributes('aria-label')).toBe('Sam Smith (2 tabs) and Alex on this page, 1 other editor elsewhere. Show editors')
  })

  test('the trigger names only the editors elsewhere when nobody else is here', async () => {
    mockCwa()
    presence!.start(true)
    arrive(ids[0]!, SAM, { page: ABOUT })
    arrive(ids[1]!, JO, { page: CONTACT })
    const wrapper = await mountIndicator()

    expect(wrapper.get('[data-testid="presence-indicator"]').attributes('aria-label')).toBe('2 other editors elsewhere. Show editors')
  })

  test('while the connection is down it says live editing is paused instead of showing anyone', async () => {
    mockCwa()
    presence!.start(true)
    arrive(ids[0]!, SAM, {})
    presence!.paused()
    const wrapper = await mountIndicator()

    const pausedNotice = wrapper.get('[data-testid="presence-paused"]')
    expect(text(pausedNotice.element)).toBe('Live editing paused')
    expect(pausedNotice.attributes('role')).toBe('status')
    expect(pausedNotice.attributes('title')).toBe('Other editors\' changes and who is here will catch up when the connection returns. You can keep editing.')
    expect(wrapper.findAll('[data-testid="presence-avatar"]')).toHaveLength(0)
  })

  test('the list names each person, their page and what they are doing', async () => {
    mockCwa({
      [ABOUT]: { '@id': ABOUT, 'title': 'About us', 'route': '/_/routes/about' },
      '/_/routes/about': { '@id': '/_/routes/about', 'path': '/about' },
      '/component/html_contents/c1': { '@id': '/component/html_contents/c1', '@type': 'HtmlContent' },
    })
    presence!.start(true)
    arrive(ids[0]!, SAM, { state: 'selected', component: '/component/html_contents/c1' })
    arrive(ids[1]!, ALEX, { page: ABOUT })
    arrive(ids[2]!, JO, { page: CONTACT, state: 'selected', component: '/component/titles/unknown' })

    const { rows } = await openList()

    expect(rows.map(texts)).toStrictEqual([
      'Sam Smith This page Selected Rich text',
      'Alex About us Viewing',
      `Jo Bloggs ${CONTACT} Selected a component`,
    ])
  })

  test('someone editing a component is listed as editing it', async () => {
    mockCwa({ '/component/html_contents/c1': { '@id': '/component/html_contents/c1', '@type': 'HtmlContent' } })
    presence!.start(true)
    arrive(ids[0]!, SAM, { state: 'editing', component: '/component/html_contents/c1', field: 'html' })

    const { rows } = await openList()

    expect(rows.map(texts)).toStrictEqual(['Sam Smith This page Editing Rich text'])
  })

  test('a page link sends this tab\'s waiting saves first, then goes to the route path past the editing guard', async () => {
    mockCwa({
      [ABOUT]: { '@id': ABOUT, 'title': 'About us', 'route': '/_/routes/about' },
      '/_/routes/about': { '@id': '/_/routes/about', 'path': '/about' },
    })
    presence!.start(true)
    arrive(ids[1]!, ALEX, { page: ABOUT })
    const { rows } = await openList()

    rows[0]!.querySelector<HTMLElement>('a')!.click()
    await flushPromises()

    expect(flush).toHaveBeenCalledExactlyOnceWith(false)
    expect(navigateTo).toHaveBeenCalledWith({ path: '/about', query: { cwa_force: 'true' } })
    expect(order).toStrictEqual(['flush', 'navigate'])
  })

  test('a page link\'s href is the router\'s, with the app base and past the editing guard, so it can be opened in a new tab', async () => {
    mockCwa({
      [ABOUT]: { '@id': ABOUT, 'title': 'About us', 'route': '/_/routes/about' },
      '/_/routes/about': { '@id': '/_/routes/about', 'path': '/about' },
    })
    presence!.start(true)
    arrive(ids[1]!, ALEX, { page: ABOUT })
    arrive(ids[2]!, JO, { page: CONTACT })
    const { rows } = await openList()

    expect(rows.map(row => row.querySelector('a')?.getAttribute('href'))).toStrictEqual([
      '/base/about?cwa_force=true',
      `/base/_cwa-resource-page/${CONTACT}?cwa_force=true`,
    ])
  })

  test.each([
    { name: 'Cmd', init: { metaKey: true } },
    { name: 'Ctrl', init: { ctrlKey: true } },
    { name: 'Shift', init: { shiftKey: true } },
    { name: 'Alt', init: { altKey: true } },
    { name: 'middle button', init: { button: 1 } },
  ])('a $name click on a page link is left to the browser', async ({ init }) => {
    mockCwa({
      [ABOUT]: { '@id': ABOUT, 'title': 'About us', 'route': '/_/routes/about' },
      '/_/routes/about': { '@id': '/_/routes/about', 'path': '/about' },
    })
    presence!.start(true)
    arrive(ids[1]!, ALEX, { page: ABOUT })
    const { rows } = await openList()

    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init })
    rows[0]!.querySelector('a')!.dispatchEvent(event)
    await flushPromises()

    expect(event.defaultPrevented).toBe(false)
    expect(flush).not.toHaveBeenCalled()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  test('a page with no known route path is opened by its internal link', async () => {
    mockCwa()
    presence!.start(true)
    arrive(ids[1]!, ALEX, { page: CONTACT })
    const { rows } = await openList()

    rows[0]!.querySelector<HTMLElement>('a')!.click()
    await flushPromises()

    expect(navigateTo).toHaveBeenCalledWith({ name: '_cwa-resource-page', params: { cwaPage0: CONTACT }, query: { cwa_force: 'true' } })
  })

  test('a peer on a page that is a route path is opened at that path', async () => {
    mockCwa()
    presence!.start(true)
    arrive(ids[1]!, ALEX, { page: '/_cwa/users' })
    const { rows } = await openList()

    rows[0]!.querySelector<HTMLElement>('a')!.click()
    await flushPromises()

    expect(navigateTo).toHaveBeenCalledWith({ path: '/_cwa/users', query: { cwa_force: 'true' } })
  })
})

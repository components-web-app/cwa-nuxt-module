// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { DropdownMenuContent } from 'reka-ui'

const state = vi.hoisted(() => ({ cwa: null as any, router: null as any }))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: vi.fn(() => state.cwa),
}))

vi.mock('#app/composables/router', () => ({
  useRouter: () => state.router,
}))

vi.mock('#cwa/admin/page-link', async importOriginal => ({
  ...await importOriginal<typeof import('#cwa/admin/page-link')>(),
  followPageLink: vi.fn(async () => {}),
}))

const STACK = [
  { iri: '/component/link', displayName: 'Call to action', domElements: ref([]), childIris: ref([]) },
  { iri: '/_/component_positions/p1', domElements: ref([]), childIris: ref([]) },
]

function makeCwa() {
  return {
    admin: { resourceStackManager: { selectStack: vi.fn(async () => {}) } },
  }
}

function anchor(href: string) {
  const element = document.createElement('a')
  element.setAttribute('href', href)
  return element
}

const mounted: { unmount: () => void }[] = []

async function mountMenu(opts: { stack?: typeof STACK, href?: string, type?: 'page' | 'layout' } = {}) {
  state.cwa = makeCwa()
  state.router = { options: { history: { base: '' } } }
  const { default: LinkMenu } = await import('./LinkMenu.vue')
  const wrapper = mount(LinkMenu, {
    attachTo: document.body,
    props: { stack: opts.stack ?? STACK, type: opts.type ?? 'layout', point: { x: 120, y: 80 }, link: anchor(opts.href ?? '/blog/post') },
  })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

function items() {
  return [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]
}

describe('LinkMenu', () => {
  afterEach(() => {
    mounted.splice(0).forEach(wrapper => wrapper.unmount())
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  test('opens at the click point as a kit menu: Edit <component> first, then Visit <path>', async () => {
    const wrapper = await mountMenu()

    expect(wrapper.findComponent(DropdownMenuContent).props('reference').getBoundingClientRect()).toMatchObject({ x: 120, y: 80, width: 0, height: 0 })
    expect(items().map(item => item.textContent!.trim())).toEqual(['Edit Call to action', 'Visit /blog/post'])
  })

  test('Edit has focus when the menu opens, so Enter selects the component as the click used to', async () => {
    await mountMenu()

    expect(document.activeElement).toBe(items()[0])
  })

  test('Edit selects the clicked stack in its scope, leaving the scope confirm to the stack manager, and closes the menu', async () => {
    const wrapper = await mountMenu({ type: 'layout' })

    items()[0]!.click()
    await flushPromises()

    expect(state.cwa.admin.resourceStackManager.selectStack).toHaveBeenCalledWith(STACK, 'layout')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  test('Visit follows the link without selecting anything or asking about the scope', async () => {
    const { followPageLink } = await import('#cwa/admin/page-link')
    const wrapper = await mountMenu()

    items()[1]!.click()
    await flushPromises()

    expect(followPageLink).toHaveBeenCalledWith(state.cwa, state.router, { kind: 'internal', path: '/blog/post' })
    expect(state.cwa.admin.resourceStackManager.selectStack).not.toHaveBeenCalled()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  test('a link to another site offers to open it in a new tab', async () => {
    await mountMenu({ href: 'https://example.com/' })

    expect(items().map(item => item.textContent!.trim())).toEqual(['Edit Call to action', 'Open in new tab ↗'])
  })

  test('a link outside every component offers Visit alone', async () => {
    await mountMenu({ stack: [] })

    expect(items().map(item => item.textContent!.trim())).toEqual(['Visit /blog/post'])
  })
})

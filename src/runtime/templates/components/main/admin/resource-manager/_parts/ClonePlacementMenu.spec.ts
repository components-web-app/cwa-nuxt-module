// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { DropdownMenuContent } from 'reka-ui'
import { useCloneMode } from '#cwa/admin/clone-mode'
import type Cwa from '#cwa/cwa'
import { onPhone } from '../../../../../../../../test/utils/sheet-media'

const state = vi.hoisted(() => ({ cwa: null as any, editingLayoutWhenCloned: undefined as boolean | undefined, confirm: { answer: true, asked: [] as unknown[] } }))

vi.mock('#app/nuxt', async importOriginal => ({
  ...await importOriginal<typeof import('#app/nuxt')>(),
  useNuxtApp: () => ({ vueApp: { name: 'vue-app' } }),
}))

vi.mock('#cwa/admin/resource-confirm', () => ({
  confirmResourceAction: vi.fn(async (_app: unknown, options: unknown) => {
    state.confirm.asked.push(options)
    return state.confirm.answer
  }),
}))

const routerState = vi.hoisted(() => ({ router: { options: { history: { base: '' } } } }))

vi.mock('#app/composables/router', () => ({
  useRouter: () => routerState.router,
}))

vi.mock('#cwa/admin/page-link', async importOriginal => ({
  ...await importOriginal<typeof import('#cwa/admin/page-link')>(),
  followPageLink: vi.fn(async () => {}),
}))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: vi.fn(() => state.cwa),
}))

vi.mock('#cwa/admin/clone-component', () => ({
  cloneComponent: vi.fn(async () => {
    state.editingLayoutWhenCloned = state.cwa.admin.resourceStackManager.isEditingLayout.value
    return 'added'
  }),
  moveComponent: vi.fn(async () => {
    state.editingLayoutWhenCloned = state.cwa.admin.resourceStackManager.isEditingLayout.value
    return 'added'
  }),
}))

const SOURCE = '/component/html_contents/source'
const LAYOUT = '/_/layouts/layout'
const GROUP = '/_/component_groups/layout-group'
const POSITION = '/_/component_positions/p1'
const COMPONENT = '/component/html_contents/c1'
const PAGE = '/_/pages/page'
const DYNAMIC = '/_/component_positions/dynamic'
const PAGE_DATA = '/page_data/article'
const OCCUPANT = '/component/html_contents/occupant'
const MOVE = { positionIri: '/_/component_positions/source', fromLayout: false, from: { componentPosition: '/_/component_positions/source' } }
const MOVE_FIRST = { positionIri: POSITION, fromLayout: true, from: { componentPosition: POSITION } }

const byId: Record<string, Record<string, any>> = {
  [SOURCE]: { '@type': 'HtmlContent' },
  [LAYOUT]: { componentGroups: [GROUP] },
  [GROUP]: { componentPositions: [POSITION] },
  [POSITION]: { component: COMPONENT },
  [COMPONENT]: { '@type': 'HtmlContent' },
  [DYNAMIC]: { pageDataProperty: 'hero' },
  [PAGE_DATA]: { hero: OCCUPANT, _metadata: { pageDataMetadata: { properties: [{ property: 'hero', componentShortName: 'HtmlContent' }] } } },
  [OCCUPANT]: { '@type': 'HtmlContent' },
}

const LAYOUT_STACK = [{ iri: COMPONENT }, { iri: POSITION }, { iri: GROUP }, { iri: LAYOUT }]

function textElement(text: string) {
  const element = document.createElement('div')
  element.textContent = text
  return element
}

function makeCwa() {
  return {
    admin: {
      isEditing: true,
      resourceStackManager: { isEditingLayout: ref(false) },
    },
    auth: { user: { '@id': '/_/users/admin' } },
    resourcesConfig: { HtmlContent: { name: 'Body Text' } },
    getComponentMetadata: vi.fn(async () => ({
      HtmlContent: { resourceName: 'HtmlContent', endpoint: '/component/html_contents', isPublishable: true, explicitAllowOnly: false },
    })),
    resources: {
      displayPageIri: computed(() => undefined),
      isDataPage: computed(() => false),
      getResource: (iri: string) => computed(() => byId[iri] ? { data: byId[iri] } : undefined),
      getChildIris: () => [],
      findAllPublishableIris: (iri: string) => [iri],
      pageDataIriOf: (iri: string) => computed(() => iri === DYNAMIC ? PAGE_DATA : undefined),
      getOrderedPositionsForGroup: (iri: string) => byId[iri]?.componentPositions,
    },
  }
}

const mounted: { unmount: () => void }[] = []

async function mountMenu(type: 'page' | 'layout' = 'layout', stack: Record<string, any>[] = LAYOUT_STACK, link?: HTMLAnchorElement) {
  const { default: ClonePlacementMenu } = await import('./ClonePlacementMenu.vue')
  const wrapper = mount(ClonePlacementMenu, {
    attachTo: document.body,
    props: {
      stack,
      type,
      point: { x: 310, y: 420 },
      link,
    },
  })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

function menu() {
  return document.body.querySelector<HTMLElement>('[data-testid="clone-menu"]')
}

function options() {
  return [...document.body.querySelectorAll<HTMLElement>('[data-testid="clone-option"]')]
}

function isDisabled(element: HTMLElement) {
  return element.getAttribute('aria-disabled') === 'true'
}

function option(label: string) {
  return options().find(button => button.textContent?.trim() === label)
}

async function openWhy(name: string) {
  const trigger = document.body.querySelector<HTMLElement>(`[aria-label="${name}"]`)
  expect(trigger).not.toBeNull()
  trigger!.click()
  await flushPromises()
  return document.body.querySelector<HTMLElement>('[data-testid="menu-item-reasons"]')
}

function startCloning(move?: typeof MOVE | typeof MOVE_FIRST) {
  state.cwa = makeCwa()
  const cloneMode = useCloneMode(state.cwa as Cwa)
  move ? cloneMode.start(SOURCE, 'Source', move) : cloneMode.start(SOURCE, 'Source')
  return cloneMode
}

function editingLayout() {
  state.cwa.admin.resourceStackManager.isEditingLayout.value = true
}

describe('ClonePlacementMenu', () => {
  afterEach(() => {
    mounted.splice(0).forEach(wrapper => wrapper.unmount())
    state.cwa && useCloneMode(state.cwa as Cwa).end()
    state.editingLayoutWhenCloned = undefined
    state.confirm.answer = true
    state.confirm.asked = []
    document.body.innerHTML = ''
  })

  test('a click on a link puts Visit <path> first, apart from the placements, so the editor can go there and place on the next page (#157)', async () => {
    startCloning()
    editingLayout()
    const link = document.createElement('a')
    link.setAttribute('href', '/blog/post')
    await mountMenu('layout', LAYOUT_STACK, link)

    const rows = [...menu()!.querySelectorAll<HTMLElement>('[role="menuitem"], [role="separator"]')]
    expect(rows.map(row => row.getAttribute('role') === 'separator' ? '—' : row.textContent!.trim())).toEqual(['Visit /blog/post', '—', 'Add before', 'Add after'])
  })

  test('Visit follows the link, places nothing and keeps clone mode on', async () => {
    const cloneMode = startCloning()
    editingLayout()
    const { followPageLink } = await import('#cwa/admin/page-link')
    const { cloneComponent } = await import('#cwa/admin/clone-component')
    const link = document.createElement('a')
    link.setAttribute('href', '/blog/post')
    const wrapper = await mountMenu('layout', LAYOUT_STACK, link)

    document.body.querySelector<HTMLElement>('[data-testid="clone-visit"]')!.click()
    await flushPromises()

    expect(followPageLink).toHaveBeenCalledWith(state.cwa, routerState.router, { kind: 'internal', path: '/blog/post' })
    expect(cloneComponent).not.toHaveBeenCalled()
    expect(cloneMode.source.value?.iri).toBe(SOURCE)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  test('a link outside every component offers Visit beside the reason nothing can be placed', async () => {
    startCloning()
    const link = document.createElement('a')
    link.setAttribute('href', '/blog/post')
    await mountMenu('page', [], link)

    expect([...menu()!.querySelectorAll('[role="menuitem"]')].map(row => row.textContent!.trim())).toEqual(['Visit /blog/post', 'Nothing can be placed here', ''])
  })

  test('opens at the click point and flips or shifts to stay on screen near the viewport edges', async () => {
    startCloning()
    editingLayout()
    const wrapper = await mountMenu()

    const content = wrapper.findComponent(DropdownMenuContent)
    expect(content.props('reference').getBoundingClientRect()).toMatchObject({ x: 310, y: 420, top: 420, left: 310, right: 310, bottom: 420, width: 0, height: 0 })
    expect(content.props('avoidCollisions')).toBe(true)
    expect(content.props('collisionPadding')).toBeGreaterThan(0)
    expect(content.props('side')).toBe('bottom')
    expect(content.props('align')).toBe('start')
    expect(menu()).not.toBeNull()
  })

  test('lists the options from cloneTargetOptions under the heading, as items of a kit menu', async () => {
    startCloning()
    editingLayout()
    const elements = { value: [textElement('Third page component')] }
    await mountMenu('layout', [{ iri: COMPONENT, displayName: 'Body Text', domElements: elements }, { iri: POSITION, domElements: elements }, { iri: GROUP }, { iri: LAYOUT }])

    expect(menu()!.querySelector('[data-testid="clone-menu-title"]')!.textContent!.trim()).toBe('Clone next to “Third page component”')
    expect(options().map(button => button.textContent!.trim())).toEqual(['Add before', 'Add after'])
    expect(options().every(item => !isDisabled(item) && item.getAttribute('role') === 'menuitem')).toBe(true)
    expect(menu()!.getAttribute('role')).toBe('menu')
    expect(menu()!.getAttribute('aria-label')).toBe('Clone next to “Third page component”')
    expect(menu()!.classList).toContain('cwa:bg-surface-menu')
  })

  test('a disabled option is greyed with a ⓘ that shows its reasons in a popover on click, and choosing it sends nothing', async () => {
    startCloning(MOVE_FIRST)
    editingLayout()
    const { moveComponent } = await import('#cwa/admin/clone-component')
    await mountMenu('layout', [{ iri: GROUP }, { iri: LAYOUT }])
    const toStart = option('Add to Start')!
    const toEnd = option('Add to End')!

    expect(isDisabled(toStart)).toBe(true)
    expect(toStart.querySelector('.cwa\\:opacity-50')).not.toBeNull()
    expect(isDisabled(toEnd)).toBe(false)
    expect(toEnd.querySelector('.cwa\\:opacity-50')).toBeNull()
    expect(document.body.querySelector('[aria-label="Why Add to End is unavailable"]')).toBeNull()
    expect(document.body.querySelector('[data-testid="menu-item-reasons"]')).toBeNull()
    expect(menu()!.textContent).not.toContain('This is where it already is')

    const reasons = await openWhy('Why Add to Start is unavailable')
    expect([...reasons!.querySelectorAll('li')].map(item => item.textContent!.trim())).toEqual(['This is where it already is'])
    expect(menu()).not.toBeNull()

    toStart.click()
    await flushPromises()
    expect(moveComponent).not.toHaveBeenCalled()
  })

  describe('the notes line', () => {
    test('a layout target while already editing the layout says it is shared by every page, muted', async () => {
      startCloning()
      editingLayout()
      await mountMenu()

      const notes = menu()!.querySelector<HTMLElement>('[data-testid="clone-notes"]')!
      expect(notes.textContent!.trim()).toBe('Shared layout: this appears on every page')
      expect(notes.className).toContain('cwa:text-fg-muted')
      expect(notes.className).not.toContain('cwa:text-warning-fg')
    })

    test('a move from the layout into the page says the scope and that it leaves the layout on one muted line', async () => {
      state.cwa = makeCwa()
      editingLayout()
      useCloneMode(state.cwa as Cwa).start(SOURCE, 'Source', { ...MOVE, fromLayout: true })
      await mountMenu('page')

      const notes = menu()!.querySelectorAll<HTMLElement>('[data-testid="clone-notes"]')
      expect(notes).toHaveLength(1)
      expect(notes[0]!.textContent!.trim()).toBe('This is in the page: it will not appear on other pages using the layout · This takes it out of the layout: it will no longer appear on other pages')
      expect(notes[0]!.querySelector('[data-testid="move-leaves-layout"]')).not.toBeNull()
      expect(notes[0]!.className).toContain('cwa:text-fg-muted')
    })

    test('a clone gives no leave-the-layout note', async () => {
      startCloning()
      editingLayout()
      await mountMenu('page')

      expect(menu()!.querySelector('[data-testid="move-leaves-layout"]')).toBeNull()
    })

    test('Use here on a page-data slot holding another component says it replaces it', async () => {
      startCloning()
      state.cwa.resources.isDataPage = computed(() => true)
      await mountMenu('page', [{ iri: DYNAMIC }, { iri: PAGE }])

      expect(isDisabled(option('Use here')!)).toBe(false)
      expect(menu()!.querySelector('[data-testid="clone-notes"]')!.textContent!.trim()).toBe('This replaces Body Text')
    })

    test('a page target while editing the page has no notes line', async () => {
      startCloning()
      await mountMenu('page')

      expect(menu()!.querySelector('[data-testid="clone-notes"]')).toBeNull()
    })
  })

  describe('nothing allowed', () => {
    test('is one disabled row whose ⓘ gives every reason once, by the type\'s display name', async () => {
      startCloning()
      byId[GROUP]!.allowedComponents = ['/component/navigation_links']
      try {
        await mountMenu()

        expect(options()).toHaveLength(0)
        const row = menu()!.querySelector<HTMLElement>('[data-testid="clone-nothing"]')!
        expect(row.textContent!.trim()).toBe('Nothing can be placed here')
        expect(isDisabled(row)).toBe(true)
        const reasons = await openWhy('Why nothing can be placed here')
        expect([...reasons!.querySelectorAll('li')].map(item => item.textContent!.trim())).toEqual(['This group does not allow Body Text'])
        expect(document.body.textContent).not.toContain('HtmlContent')
        expect(state.confirm.asked).toEqual([])
      }
      finally {
        delete byId[GROUP]!.allowedComponents
      }
    })

    test('with no option at all, its ⓘ says a component cannot be added here', async () => {
      startCloning()
      await mountMenu('page', [{ iri: PAGE }])

      const reasons = await openWhy('Why nothing can be placed here')
      expect(reasons!.textContent!.trim()).toBe('A component cannot be added here')
    })
  })

  describe('closing', () => {
    test('Escape closes the menu and keeps clone mode on', async () => {
      const cloneMode = startCloning()
      editingLayout()
      const wrapper = await mountMenu()

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
      await flushPromises()

      expect(wrapper.emitted('close')).toHaveLength(1)
      expect(cloneMode.source.value).toEqual({ iri: SOURCE, name: 'Source' })
    })

    test('Escape with a ⓘ popover open closes only the popover', async () => {
      startCloning(MOVE_FIRST)
      editingLayout()
      const wrapper = await mountMenu('layout', [{ iri: GROUP }, { iri: LAYOUT }])
      await openWhy('Why Add to Start is unavailable')

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
      await flushPromises()

      expect(document.body.querySelector('[data-testid="menu-item-reasons"]')).toBeNull()
      expect(menu()).not.toBeNull()
      expect(wrapper.emitted('close')).toBeUndefined()
    })

    test('a click outside closes the menu and keeps clone mode on, and a click in a ⓘ popover does not', async () => {
      const cloneMode = startCloning(MOVE_FIRST)
      editingLayout()
      const wrapper = await mountMenu('layout', [{ iri: GROUP }, { iri: LAYOUT }])
      const reasons = await openWhy('Why Add to Start is unavailable')
      await new Promise(resolve => setTimeout(resolve))

      reasons!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      await flushPromises()
      expect(wrapper.emitted('close')).toBeUndefined()

      const outside = document.createElement('div')
      document.body.appendChild(outside)
      outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      await flushPromises()

      expect(wrapper.emitted('close')).toHaveLength(1)
      expect(cloneMode.source.value).toBeDefined()
    })

    test('closes when clone mode ends', async () => {
      const cloneMode = startCloning()
      const wrapper = await mountMenu()

      cloneMode.end()
      await flushPromises()

      expect(wrapper.emitted('close')).toHaveLength(1)
    })
  })

  describe('placing', () => {
    test('an option in the scope being edited places at once, then closes', async () => {
      startCloning()
      editingLayout()
      const { cloneComponent } = await import('#cwa/admin/clone-component')
      const wrapper = await mountMenu()

      option('Add after')!.click()
      await flushPromises()

      expect(state.confirm.asked).toEqual([])
      expect(cloneComponent).toHaveBeenCalledWith(state.cwa, {
        sourceIri: SOURCE,
        target: { kind: 'position', groupIri: GROUP, anchor: { after: POSITION } },
      })
      expect(state.editingLayoutWhenCloned).toBe(true)
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    test('a move sends the source and where Move started instead of cloning', async () => {
      startCloning(MOVE)
      editingLayout()
      const { cloneComponent, moveComponent } = await import('#cwa/admin/clone-component')
      await mountMenu()

      option('Add after')!.click()
      await flushPromises()

      expect(moveComponent).toHaveBeenCalledWith(state.cwa, {
        sourceIri: SOURCE,
        move: MOVE,
        target: { kind: 'position', groupIri: GROUP, anchor: { after: POSITION } },
      })
      expect(cloneComponent).not.toHaveBeenCalled()
    })
  })

  describe('switching scope', () => {
    test('an option in the layout while editing the page asks "Edit the shared layout?" first, then places in the layout', async () => {
      startCloning()
      const { cloneComponent } = await import('#cwa/admin/clone-component')
      const wrapper = await mountMenu()

      let editingLayoutWhenAsked: boolean | undefined
      const { confirmResourceAction } = await import('#cwa/admin/resource-confirm')
      vi.mocked(confirmResourceAction).mockImplementationOnce(async (_app, options) => {
        state.confirm.asked.push(options)
        editingLayoutWhenAsked = state.cwa.admin.resourceStackManager.isEditingLayout.value
        expect(cloneComponent).not.toHaveBeenCalled()
        expect(menu()).toBeNull()
        return true
      })
      option('Add after')!.click()
      await vi.waitFor(() => expect(cloneComponent).toHaveBeenCalled())
      await flushPromises()

      expect(state.confirm.asked).toEqual([{ title: 'Edit the shared layout?', description: 'It will appear on every page that uses this layout.', go: 'Edit layout', keep: 'Cancel', tone: 'accent' }])
      expect(editingLayoutWhenAsked).toBe(false)

      expect(cloneComponent).toHaveBeenCalledWith(state.cwa, {
        sourceIri: SOURCE,
        target: { kind: 'position', groupIri: GROUP, anchor: { after: POSITION } },
      })
      expect(state.editingLayoutWhenCloned).toBe(true)
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    test('Cancel on the scope question closes, sends nothing, leaves the scope and keeps clone mode on', async () => {
      const cloneMode = startCloning()
      const { cloneComponent } = await import('#cwa/admin/clone-component')
      const wrapper = await mountMenu()
      state.confirm.answer = false
      option('Add after')!.click()
      await vi.waitFor(() => expect(wrapper.emitted('close')).toHaveLength(1))
      await flushPromises()

      expect(state.confirm.asked).toHaveLength(1)
      expect(wrapper.emitted('close')).toHaveLength(1)
      expect(cloneComponent).not.toHaveBeenCalled()
      expect(cloneMode.source.value).toBeDefined()
      expect(state.cwa.admin.resourceStackManager.isEditingLayout.value).toBe(false)
    })

    test('an option in the page while editing the layout asks "Edit the page?" with Edit page', async () => {
      startCloning()
      editingLayout()
      await mountMenu('page')
      option('Add after')!.click()
      await vi.waitFor(() => expect(state.confirm.asked).toHaveLength(1))

      expect(state.confirm.asked[0]).toMatchObject({ title: 'Edit the page?', go: 'Edit page', keep: 'Cancel' })
    })
  })

  describe('the heading names the anchor (#414)', () => {
    test('in a move, by an excerpt of its content', async () => {
      startCloning(MOVE)
      editingLayout()
      const elements = { value: [textElement(' Third page\n component ')] }
      await mountMenu('layout', [{ iri: COMPONENT, displayName: 'Body Text', domElements: elements }, { iri: POSITION, domElements: elements }, { iri: GROUP }, { iri: LAYOUT }])

      expect(menu()!.querySelector('[data-testid="clone-menu-title"]')!.textContent!.trim()).toBe('Move next to “Third page component”')
    })

    test('by its type when it has no text, as for an image', async () => {
      startCloning()
      editingLayout()
      const elements = { value: [document.createElement('img')] }
      await mountMenu('layout', [{ iri: COMPONENT, displayName: 'Image', domElements: elements }, { iri: POSITION, domElements: elements }, { iri: GROUP }, { iri: LAYOUT }])

      expect(menu()!.querySelector('[data-testid="clone-menu-title"]')!.textContent!.trim()).toBe('Clone next to Image')
    })

    test('a clicked group is headed Clone Here, as there is no component to be next to', async () => {
      startCloning()
      editingLayout()
      await mountMenu('layout', [{ iri: GROUP }, { iri: LAYOUT }])

      expect(menu()!.querySelector('[data-testid="clone-menu-title"]')!.textContent!.trim()).toBe('Clone Here')
    })
  })

  describe('the target outline', () => {
    test('outlines the anchor\'s elements while the menu and the scope question are open, and clears it on close', async () => {
      const cloneMode = startCloning()
      const elements = { value: [textElement('Third page component')] }
      const wrapper = await mountMenu('layout', [{ iri: COMPONENT, domElements: { value: [] } }, { iri: POSITION, domElements: elements }, { iri: GROUP }, { iri: LAYOUT }])

      expect(cloneMode.target.value).toEqual(elements.value)
      let targetWhenAsked: unknown
      const { confirmResourceAction } = await import('#cwa/admin/resource-confirm')
      vi.mocked(confirmResourceAction).mockImplementationOnce(async () => {
        targetWhenAsked = cloneMode.target.value
        return false
      })
      option('Add after')!.click()
      await vi.waitFor(() => expect(wrapper.emitted('close')).toHaveLength(1))
      expect(targetWhenAsked).toEqual(elements.value)
      wrapper.unmount()
      mounted.splice(mounted.indexOf(wrapper), 1)
      expect(cloneMode.target.value).toBeUndefined()
    })

    test('outlines the clicked group when there is no anchor', async () => {
      const cloneMode = startCloning()
      editingLayout()
      const groupElements = { value: [document.createElement('section')] }
      await mountMenu('layout', [{ iri: GROUP, domElements: groupElements }, { iri: LAYOUT }])

      expect(cloneMode.target.value).toEqual(groupElements.value)
    })
  })

  test('says so when the available components cannot be loaded', async () => {
    startCloning()
    state.cwa.getComponentMetadata = vi.fn(async () => undefined)
    await mountMenu()

    expect(menu()!.textContent).toContain('Could not load the available components')
  })

  describe('on a phone (#461)', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    test('opens as a bottom sheet titled once by its heading, its notes under the title, and placing still clones', async () => {
      onPhone()
      startCloning()
      editingLayout()
      const { cloneComponent } = await import('#cwa/admin/clone-component')
      const elements = { value: [textElement('Third page component')] }
      const wrapper = await mountMenu('layout', [{ iri: COMPONENT, displayName: 'Body Text', domElements: elements }, { iri: POSITION, domElements: elements }, { iri: GROUP }, { iri: LAYOUT }])

      const sheet = document.querySelector<HTMLElement>('[data-testid="kit-menu-sheet"]')!
      expect(document.getElementById(sheet.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('Clone next to “Third page component”')
      expect(sheet.textContent!.split('Clone next to “Third page component”')).toHaveLength(2)
      expect(document.querySelector('[data-testid="clone-menu-title"]')).toBeNull()
      expect(sheet.querySelector('[data-testid="clone-notes"]')!.textContent!.trim()).toBe('Shared layout: this appears on every page')
      expect(sheet.contains(menu())).toBe(true)

      option('Add after')!.click()
      await flushPromises()
      expect(cloneComponent).toHaveBeenCalledWith(state.cwa, {
        sourceIri: SOURCE,
        target: { kind: 'position', groupIri: GROUP, anchor: { after: POSITION } },
      })
      expect(wrapper.emitted('close')).toHaveLength(1)
    })
  })
})

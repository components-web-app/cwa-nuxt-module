import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import ResourceStackManager from './resource-stack-manager'

const confirm = vi.hoisted(() => ({ answer: true, calls: 0 }))

vi.mock('./resource-confirm', () => ({
  confirmResourceAction: vi.fn(async () => {
    confirm.calls++
    return confirm.answer
  }),
}))
vi.mock('#app/nuxt', () => ({
  useNuxtApp: () => ({ vueApp: { _container: null } }),
}))

const COMPONENT = '/component/html_contents/1'
const POSITION = '/_/component_positions/1'
const GROUP = '/_/component_groups/main'
const PAGE = '/_/pages/home'
const OTHER = '/component/html_contents/2'
const OTHER_POSITION = '/_/component_positions/2'
const LAYOUT_COMPONENT = '/component/navigation_links/1'
const LAYOUT_GROUP = '/_/component_groups/top'
const LAYOUT = '/_/layouts/main'

const children: Record<string, string[]> = {
  [POSITION]: [COMPONENT],
  [GROUP]: [POSITION, OTHER_POSITION],
  [OTHER_POSITION]: [OTHER],
  [PAGE]: [GROUP],
  [LAYOUT_GROUP]: [LAYOUT_COMPONENT],
  [LAYOUT]: [LAYOUT_GROUP],
}

function createManager() {
  const adminState = reactive({ isEditing: true })
  const resources = {
    isDataPage: ref(false),
    isPageDataResource: () => ref(false),
    displayPageIri: ref<string | undefined>(PAGE),
  }
  const manager = new ResourceStackManager(
    { useStore: () => ({ state: adminState }) } as any,
    {
      useStore: () => ({
        state: reactive({}),
        findAllPublishableIris: (iri: string) => [iri],
        isIriPublishableEquivalent: (a: string, b: string) => a === b,
        findDraftComponentIri: () => undefined,
        findPublishedComponentIri: (iri: string) => iri,
      }),
    } as any,
    resources as any,
    {} as any,
  )
  return { manager, adminState, resources }
}

function build(manager: ResourceStackManager, iris: string[], type: 'page' | 'layout', isContext = false) {
  for (const iri of iris) {
    manager.addToStack({ iri, domElements: ref([]), childIris: ref(children[iri] ?? []), displayName: iri, clickTarget: document.createElement('span') } as any, isContext)
  }
  manager.completeStack({ clickTarget: window }, isContext, type)
}

async function click(manager: ResourceStackManager, iris: string[], type: 'page' | 'layout' = 'page') {
  build(manager, iris, type)
  await manager.selectStackIndex(0, false)
  await nextTick()
}

function emptyStack(manager: ResourceStackManager) {
  manager.completeStack({ clickTarget: window }, false)
  manager.showManager.value = false
}

function path(manager: ResourceStackManager) {
  const { stack, index } = manager.pathStack.value
  return { iris: stack.map(item => item.iri), index }
}

function selection(manager: ResourceStackManager) {
  return manager.resourceStack.value.map(item => item.iri)
}

const PAGE_CLICK = [COMPONENT, POSITION, GROUP, PAGE]

describe('ResourceStackManager keeps the clicked stack (#461)', () => {
  beforeEach(() => {
    vi.spyOn(ResourceStackManager.prototype as unknown as { createFocusComponent: () => Promise<void> }, 'createFocusComponent').mockResolvedValue()
  })

  afterEach(() => {
    confirm.answer = true
    confirm.calls = 0
  })

  test('selecting a parent keeps the inner levels, and selecting the inner level again steps back down', async () => {
    const { manager } = createManager()
    await click(manager, PAGE_CLICK)
    expect(path(manager)).toEqual({ iris: PAGE_CLICK, index: 0 })

    await manager.selectStackIndex(2, false)
    expect(selection(manager)).toEqual([GROUP, PAGE])
    expect(manager.currentStackItem.value?.iri).toBe(GROUP)
    expect(path(manager)).toEqual({ iris: PAGE_CLICK, index: 2 })

    await manager.selectStackIndex(0, false)
    expect(selection(manager)).toEqual(PAGE_CLICK)
    expect(manager.currentStackItem.value?.iri).toBe(COMPONENT)
    expect(path(manager)).toEqual({ iris: PAGE_CLICK, index: 0 })
  })

  test('a level chosen from the right-click stack keeps that whole stack', async () => {
    const { manager } = createManager()
    await click(manager, [OTHER, OTHER_POSITION, GROUP, PAGE])
    build(manager, PAGE_CLICK, 'page', true)

    await manager.selectStackIndex(1, true)
    expect(selection(manager)).toEqual([POSITION, GROUP, PAGE])
    expect(path(manager)).toEqual({ iris: PAGE_CLICK, index: 1 })
    expect(manager.contextStack.value).toEqual([])
  })

  test('a new click on the page replaces the kept stack', async () => {
    const { manager } = createManager()
    await click(manager, PAGE_CLICK)
    await manager.selectStackIndex(2, false)

    await click(manager, [OTHER, OTHER_POSITION, GROUP, PAGE])
    expect(path(manager)).toEqual({ iris: [OTHER, OTHER_POSITION, GROUP, PAGE], index: 0 })
  })

  test.each([
    ['another page is shown', async ({ resources }: ReturnType<typeof createManager>) => {
      resources.displayPageIri.value = '/_/pages/about'
    }],
    ['edit mode is left', async ({ adminState }: ReturnType<typeof createManager>) => {
      adminState.isEditing = false
      await nextTick()
      adminState.isEditing = true
    }],
  ])('when %s, the kept stack is dropped and only the selection and its parents are offered', async (_label, trigger) => {
    const created = createManager()
    const { manager } = created
    await click(manager, PAGE_CLICK)
    await manager.selectStackIndex(2, false)

    await trigger(created)
    await nextTick()
    expect(path(manager)).toEqual({ iris: [GROUP, PAGE], index: 0 })
  })

  test('clearing the selection, as Escape or deleting the selected resource does, drops the kept stack', async () => {
    const { manager } = createManager()
    await click(manager, PAGE_CLICK)
    await manager.selectStackIndex(2, false)

    emptyStack(manager)
    await nextTick()
    expect(path(manager)).toEqual({ iris: [], index: 0 })

    manager.restorePreviousStack()
    expect(path(manager)).toEqual({ iris: [GROUP, PAGE], index: 0 })
  })

  test('a click on the page restored afterwards, as clone mode does, keeps the stack it had', async () => {
    const { manager } = createManager()
    await click(manager, PAGE_CLICK)
    await manager.selectStackIndex(2, false)

    build(manager, [OTHER, OTHER_POSITION, GROUP, PAGE], 'page')
    manager.restorePreviousStack()
    expect(selection(manager)).toEqual([GROUP, PAGE])
    expect(path(manager)).toEqual({ iris: PAGE_CLICK, index: 2 })
  })

  test('a cancelled layout/page confirm leaves the selection and the kept stack as they were', async () => {
    const { manager } = createManager()
    await click(manager, PAGE_CLICK)
    await manager.selectStackIndex(2, false)
    confirm.answer = false

    await click(manager, [LAYOUT_COMPONENT, LAYOUT_GROUP, LAYOUT], 'layout')
    expect(confirm.calls).toBe(1)
    expect(selection(manager)).toEqual([GROUP, PAGE])
    expect(path(manager)).toEqual({ iris: PAGE_CLICK, index: 2 })

    build(manager, [LAYOUT_COMPONENT, LAYOUT_GROUP, LAYOUT], 'layout', true)
    await manager.selectStackIndex(0, true)
    expect(confirm.calls).toBe(2)
    expect(selection(manager)).toEqual([GROUP, PAGE])
    expect(path(manager)).toEqual({ iris: PAGE_CLICK, index: 2 })
  })

  test('a confirmed switch to the layout keeps the layout\'s clicked stack', async () => {
    const { manager } = createManager()
    await click(manager, PAGE_CLICK)

    await click(manager, [LAYOUT_COMPONENT, LAYOUT_GROUP, LAYOUT], 'layout')
    expect(manager.isEditingLayout.value).toBe(true)
    expect(path(manager)).toEqual({ iris: [LAYOUT_COMPONENT, LAYOUT_GROUP, LAYOUT], index: 0 })
  })
})

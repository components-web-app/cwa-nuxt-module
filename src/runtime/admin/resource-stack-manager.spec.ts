import { describe, expect, test, vi } from 'vitest'
import { reactive, ref } from 'vue'
import ResourceStackManager from './resource-stack-manager'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    watch: vi.fn(() => {}), // mod.watch(...args)
  }
})

function createResourceManager(mockStore?: any) {
  const mockAdminStore = {
    useStore: () => mockStore || ({
      state: reactive({
        isEditing: false,
      }),
    }),
  }

  const mockResourcesStore = {
    useStore: () => mockStore || ({
      state: reactive({}),
    }),
  }

  const manager = new ResourceStackManager(mockAdminStore, mockResourcesStore)
  return {
    manager,
    store: mockAdminStore,
  }
}

describe('Resource Manager', () => {
  test.todo('Constructor should initialise a watcher', () => {
    // todo: mock properly and ensure watcher is initialised with the correct function handlers
    vi.spyOn(ResourceStackManager.prototype, 'listenEditModeChange').mockImplementationOnce(() => {})
    vi.spyOn(ResourceStackManager.prototype, 'listenCurrentIri').mockImplementationOnce(() => {})
    const mockStore = { state: { isEditing: true } }
    const { manager } = createResourceManager(mockStore)
    expect(manager.listenEditModeChange).toHaveBeenCalledOnce()
    expect(manager.listenCurrentIri).toHaveBeenCalledOnce()
  })

  describe('adminStore getter', () => {
    test('should return reference to store', () => {
      const mockStore = { state: { isEditing: true } }
      const { manager } = createResourceManager(mockStore)

      expect(manager.adminStore).toEqual(mockStore)
    })
  })

  describe('isEditing getter', () => {
    test('should return current edit status flag', () => {
      const mockStore = { state: { isEditing: true } }
      const { manager } = createResourceManager(mockStore)

      expect(manager.isEditing).toEqual(mockStore.state.isEditing)

      mockStore.state.isEditing = false

      expect(manager.isEditing).toEqual(mockStore.state.isEditing)
    })
  })

  describe('resourceStack getter', () => {
    test.each([
      { currentClickTarget: ref({}), mockStack: ['anything'], expected: [] },
      { currentClickTarget: ref(null), mockStack: [1, 2, 3], expected: [1, 2, 3] },
    ])('If currentClickTarget is $currentClickTarget the stack should return $expected', ({ currentClickTarget, mockStack, expected }) => {
      const { manager } = createResourceManager()

      manager.currentClickTarget = ref(currentClickTarget)
      manager.currentResourceStack = ref(mockStack)

      expect(manager.resourceStack.value).toEqual(expected)
    })
  })

  describe('currentStackItem getter', () => {
    test.each([
      {
        stack: [{ test: true }, null, null],
        showManager: true,
        currentClickTarget: undefined,
        toEqual: { test: true },
      },
      {
        stack: [{ test: true }, null, null],
        showManager: false,
        currentClickTarget: undefined,
        toEqual: undefined,
      },
      {
        stack: [{ test: true }, null, null],
        showManager: true,
        currentClickTarget: {},
        toEqual: undefined,
      },
      {
        stack: [],
        showManager: true,
        currentClickTarget: undefined,
        toEqual: undefined,
      },
    ])('should return first item from stack', ({ stack, showManager, currentClickTarget, toEqual }) => {
      const { manager } = createResourceManager()

      manager.showManager.value = showManager
      manager.currentClickTarget.value = currentClickTarget
      manager.currentResourceStack = ref(stack)

      expect(manager.currentStackItem.value).toEqual(toEqual)
    })
  })

  describe('stack operations', () => {
    describe('isItemAlreadyInStack', () => {
      test('should check whether item is in stack or not by iri', () => {
        const { manager } = createResourceManager()
        const mockIri = '/mock/iri'
        const mockStackItem = { iri: mockIri }

        manager.resourceStack.value.push(mockStackItem)

        expect(manager.isResourceInStack(mockIri)).toEqual(true)
        expect(manager.isResourceInStack('/random')).toEqual(false)
      })
    })

    describe('resetStack', () => {
      test('should reset stack and remove last click target', () => {
        const { manager } = createResourceManager()

        manager.currentResourceStack = ref([1, 2, 3])
        manager.currentClickTarget = ref('mock-target')

        manager.resetStack()

        expect(manager.resourceStack.value).toEqual([])
        expect(manager.currentClickTarget.value).toEqual(null)
      })
    })

    describe('addToStack', () => {
      test('should NOT add item to stack IF edit mode is off', () => {
        const mockStore = { state: { isEditing: false } }
        const { manager } = createResourceManager(mockStore)

        manager.addToStack({})

        expect(manager.resourceStack.value.length).toEqual(0)
      })

      test('should NOT add item to stack IF item with such iri already in stack', () => {
        const mockStore = { state: { isEditing: true } }
        const mockIri = '/mock'
        const { manager } = createResourceManager(mockStore)
        const mockTarget = { value: {} }

        manager.currentClickTarget = mockTarget
        manager.currentResourceStack.value = [{ iri: mockIri }]

        manager.addToStack({ iri: mockIri })

        expect(manager.resourceStack.value.length).toEqual(0)
        expect(manager.currentResourceStack.value.length).toEqual(1)
      })

      test('should always reset stack on a new click sequence regardless of what iri was previously first', () => {
        const mockStore = { state: { isEditing: true } }
        const mockIri = '/mock'
        const { manager } = createResourceManager(mockStore)
        const resetSpy = vi.spyOn(manager, 'resetStack')
        vi.spyOn(manager, 'insertResourceStackItem').mockImplementationOnce(() => {})
        manager.currentClickTarget = ref(null)
        manager.currentResourceStack = ref([{ iri: mockIri }])

        const event = { iri: mockIri, clickTarget: 'new' }
        manager.addToStack(event)
        expect(resetSpy).toHaveBeenCalled()
        expect(manager.insertResourceStackItem).toHaveBeenCalledTimes(1)
        expect(manager.currentClickTarget.value).toEqual('new')
      })

      test('should NOT add item to stack IF item has no iri', () => {
        const mockStore = { state: { isEditing: true } }
        const { manager } = createResourceManager(mockStore)
        vi.spyOn(manager, 'insertResourceStackItem').mockImplementationOnce(() => {})

        manager.addToStack({})
        expect(manager.insertResourceStackItem).not.toHaveBeenCalled()
      })

      test('should update last click target IF new click target is passed AND event has iri', () => {
        const mockStore = { state: { isEditing: true } }
        const { manager } = createResourceManager(mockStore)
        vi.spyOn(manager, 'insertResourceStackItem').mockImplementationOnce(() => {})
        const event = { iri: '/mock', clickTarget: { new: 'target' } }

        manager.currentClickTarget = ref({ old: 'target' })

        manager.addToStack(event)

        expect(manager.currentClickTarget.value).toEqual(event.clickTarget)
      })

      test('should clear the last click target IF event has no iri', () => {
        const mockStore = { state: { isEditing: true } }
        const { manager } = createResourceManager(mockStore)
        const resetSpy = vi.spyOn(manager, 'resetStack')
        manager.currentClickTarget = ref({ old: 'target' })
        manager.addToStack({})
        expect(resetSpy).not.toHaveBeenCalled()
        expect(manager.resourceStack.value.length).toEqual(0)
        expect(manager.currentClickTarget.value).toBeNull()
      })
    })

    describe('listenEditModeChange', () => {
      test.each([
        { newEditingState: false, showManager: false },
        { newEditingState: true, showManager: true },
      ])('When edit mode is changed from $initialEditingState to $newEditingState while manager is true, showManager should be $showManager', ({
        newEditingState,
        showManager,
      }) => {
        const { manager } = createResourceManager()
        manager.showManager.value = true
        vi.clearAllMocks()

        // const resetStackSpy = vi.spyOn(manager, 'resetStack')
        manager.listenEditModeChange(newEditingState)
        expect(manager.showManager.value).toEqual(showManager)
        // expect(resetStackSpy).toHaveBeenCalledTimes(timesToCall)
      })
    })
  })

  describe('state management', () => {
    test('getState returns undefined for uninitialised key', () => {
      const { manager } = createResourceManager()
      expect(manager.getState('unknown')).toBeUndefined()
    })

    test('setState stores a value and getState retrieves it', () => {
      const { manager } = createResourceManager()
      manager.setState('myProp', 'hello')
      expect(manager.getState('myProp')).toBe('hello')
    })

    test('setState overwrites existing value', () => {
      const { manager } = createResourceManager()
      manager.setState('myProp', 'first')
      manager.setState('myProp', 'second')
      expect(manager.getState('myProp')).toBe('second')
    })
  })

  describe('simple getters', () => {
    test('isEditingLayout returns false by default', () => {
      const { manager } = createResourceManager()
      expect(manager.isEditingLayout.value).toBe(false)
    })

    test('isPopulating returns false when no click target', () => {
      const { manager } = createResourceManager()
      expect(manager.isPopulating.value).toBe(false)
    })

    test('isContextPopulating returns false when no last context target', () => {
      const { manager } = createResourceManager()
      expect(manager.isContextPopulating.value).toBe(false)
    })

    test('contextStack returns empty array when lastContextTarget is set', () => {
      const { manager } = createResourceManager()
      // contextStack returns [] when lastContextTarget is truthy
      // initially lastContextTarget is null (falsy), so contextStack = contextResourceStack (empty)
      expect(manager.contextStack.value).toEqual([])
    })

    test('currentIri returns undefined when showManager is false', () => {
      const { manager } = createResourceManager()
      manager.showManager.value = false
      expect(manager.currentIri.value).toBeUndefined()
    })
  })

  describe('getClosestStackItemByType', () => {
    test('returns undefined when stack is empty', () => {
      const { manager } = createResourceManager()
      const result = manager.getClosestStackItemByType('/_/component_groups/' as any)
      expect(result).toBeUndefined()
    })
  })

  describe('listenCurrentIri (private, called via watcher)', () => {
    function createManagerWithResourcesStore(isEquivalentFn?: (a: string, b: string) => boolean) {
      const mockAdminStore = {
        useStore: () => ({ state: reactive({ isEditing: false }) }),
      }
      const mockResourcesStore = {
        useStore: () => ({
          state: reactive({}),
          isIriPublishableEquivalent: isEquivalentFn || vi.fn().mockReturnValue(false),
        }),
      }
      const manager = new ResourceStackManager(mockAdminStore as any, mockResourcesStore as any, {} as any)
      return manager
    }

    test('resets resourceManagerState when either iri is falsy', () => {
      const manager = createManagerWithResourcesStore()
      manager.setState('key', 'value')
      ;(manager as any).listenCurrentIri(undefined, '/old')
      expect(manager.getState('key')).toBeUndefined()
    })

    test('resets when both iris are truthy but not publishable equivalents', () => {
      const manager = createManagerWithResourcesStore(vi.fn().mockReturnValue(false))
      manager.setState('key', 'value')
      ;(manager as any).listenCurrentIri('/new', '/old')
      expect(manager.getState('key')).toBeUndefined()
    })

    test('does not reset when new and old iri are publishable equivalents', () => {
      const manager = createManagerWithResourcesStore(vi.fn().mockReturnValue(true))
      manager.setState('key', 'value')
      ;(manager as any).listenCurrentIri('/new', '/old')
      expect(manager.getState('key')).toBe('value')
    })
  })

  describe('isComponentGroupDisabled', () => {
    function createManagerForGroupDisabled(opts?: { isDataPage?: boolean, isLayoutStack?: boolean }) {
      const mockAdminStore = {
        useStore: () => ({ state: reactive({ isEditing: false }) }),
      }
      const mockResourcesStore = {
        useStore: () => ({
          state: reactive({}),
          isIriPublishableEquivalent: vi.fn().mockReturnValue(false),
        }),
      }
      const mockResources = {
        isDataPage: ref(opts?.isDataPage ?? false),
        isPageDataResource: vi.fn((_iri: string) => ref(false)),
      }
      const manager = new ResourceStackManager(mockAdminStore as any, mockResourcesStore as any, mockResources as any)
      if (opts?.isLayoutStack) {
        ;(manager as any).isLayoutStack.value = true
      }
      return manager
    }

    test('returns false for non-component-group IRI', () => {
      const manager = createManagerForGroupDisabled({ isDataPage: true })
      expect(manager.isComponentGroupDisabled('/component/1')).toBe(false)
    })

    test('returns false when not a data page', () => {
      const manager = createManagerForGroupDisabled({ isDataPage: false })
      expect(manager.isComponentGroupDisabled('/_/component_groups/1')).toBe(false)
    })

    test('returns false when isDataPage and isLayoutStack (editing layout)', () => {
      const manager = createManagerForGroupDisabled({ isDataPage: true, isLayoutStack: true })
      expect(manager.isComponentGroupDisabled('/_/component_groups/1')).toBe(false)
    })

    test('returns true when isDataPage and no location provided', () => {
      const manager = createManagerForGroupDisabled({ isDataPage: true })
      expect(manager.isComponentGroupDisabled('/_/component_groups/1')).toBe(true)
    })

    test('returns false when isDataPage and location is a LAYOUT', () => {
      const manager = createManagerForGroupDisabled({ isDataPage: true })
      expect(manager.isComponentGroupDisabled('/_/component_groups/1', '/_/layouts/1')).toBe(false)
    })

    test('returns true when isDataPage and location is a PAGE', () => {
      const manager = createManagerForGroupDisabled({ isDataPage: true })
      expect(manager.isComponentGroupDisabled('/_/component_groups/1', '/_/pages/1')).toBe(true)
    })

    test('returns true when isDataPage and location is PAGE_DATA', () => {
      const manager = createManagerForGroupDisabled({ isDataPage: true })
      expect(manager.isComponentGroupDisabled('/_/component_groups/1', '/page_data/1')).toBe(true)
    })

    test('returns false when isDataPage and location is not PAGE, PAGE_DATA, or LAYOUT', () => {
      const manager = createManagerForGroupDisabled({ isDataPage: true })
      // COMPONENT_POSITION is not in the disabled-location types
      expect(manager.isComponentGroupDisabled('/_/component_groups/1', '/_/component_positions/1')).toBe(false)
    })
  })

  describe('filterDisabledStackItems (private, via finishStack)', () => {
    function createManagerForFilter(opts?: {
      isDataPage?: boolean
      isPageDataResourceFn?: (iri: string) => boolean
    }) {
      const mockAdminStore = {
        useStore: () => ({ state: reactive({ isEditing: false }) }),
      }
      const mockResourcesStore = {
        useStore: () => ({
          state: reactive({}),
          isIriPublishableEquivalent: vi.fn().mockReturnValue(false),
        }),
      }
      const mockResources = {
        isDataPage: ref(opts?.isDataPage ?? false),
        isPageDataResource: vi.fn((iri: string) => ref(opts?.isPageDataResourceFn?.(iri) ?? false)),
      }
      return new ResourceStackManager(mockAdminStore as any, mockResourcesStore as any, mockResources as any)
    }

    function makeItem(iri: string) {
      return { iri, domElements: ref([]), childIris: ref([]) }
    }

    test('preserves all items when isDataPage is false', () => {
      const manager = createManagerForFilter({ isDataPage: false })
      const stack = [
        makeItem('/component/1'),
        makeItem('/_/component_groups/grp1'),
        makeItem('/_/pages/page1'),
      ]
      ;(manager as any).currentResourceStack.value = stack
      ;(manager as any).filterDisabledStackItems(false)
      expect((manager as any).currentResourceStack.value).toHaveLength(3)
    })

    test('removes component and component group when next group is disabled and item is not page data resource', () => {
      // stack: component (0), group (1), page (2)
      // group's location = page → disabled (isDataPage + PAGE location)
      const manager = createManagerForFilter({ isDataPage: true })
      const stack = [
        makeItem('/component/1'),
        makeItem('/_/component_groups/grp1'),
        makeItem('/_/pages/page1'),
      ]
      ;(manager as any).currentResourceStack.value = stack
      ;(manager as any).filterDisabledStackItems(false)
      const remaining = (manager as any).currentResourceStack.value
      // only the page item survives (not a COMPONENT or COMPONENT_GROUP)
      expect(remaining).toHaveLength(1)
      expect(remaining[0].iri).toBe('/_/pages/page1')
    })

    test('preserves component when it is a page data resource even if group is disabled', () => {
      // same stack as above but component/1 is a page data resource
      const manager = createManagerForFilter({
        isDataPage: true,
        isPageDataResourceFn: iri => iri === '/component/1',
      })
      const stack = [
        makeItem('/component/1'),
        makeItem('/_/component_groups/grp1'),
        makeItem('/_/pages/page1'),
      ]
      ;(manager as any).currentResourceStack.value = stack
      ;(manager as any).filterDisabledStackItems(false)
      const remaining = (manager as any).currentResourceStack.value
      // component/1 is preserved (isPageDataResource=true), group is removed, page is preserved
      expect(remaining).toHaveLength(2)
      expect(remaining[0].iri).toBe('/component/1')
      expect(remaining[1].iri).toBe('/_/pages/page1')
    })

    test('non-component items (route, page, layout) are always preserved', () => {
      const manager = createManagerForFilter({ isDataPage: true })
      const stack = [
        makeItem('/_/routes/r1'),
        makeItem('/_/pages/page1'),
        makeItem('/_/layouts/layout1'),
      ]
      ;(manager as any).currentResourceStack.value = stack
      ;(manager as any).filterDisabledStackItems(false)
      expect((manager as any).currentResourceStack.value).toHaveLength(3)
    })
  })

  describe('completeStack', () => {
    test('sets isLayoutStack to true when type is layout', () => {
      const { manager } = createResourceManager()
      expect((manager as any).isLayoutStack.value).toBe(false)
      manager.completeStack({ clickTarget: null }, false, 'layout')
      expect((manager as any).isLayoutStack.value).toBe(true)
    })

    test('sets isLayoutStack to false when type is page', () => {
      const { manager } = createResourceManager()
      ;(manager as any).isLayoutStack.value = true
      manager.completeStack({ clickTarget: null }, false, 'page')
      expect((manager as any).isLayoutStack.value).toBe(false)
    })

    test('does not modify isLayoutStack when no type provided', () => {
      const { manager } = createResourceManager()
      ;(manager as any).isLayoutStack.value = true
      manager.completeStack({ clickTarget: null })
      expect((manager as any).isLayoutStack.value).toBe(true)
    })
  })

  describe('selectStackIndex', () => {
    function createEditingManager() {
      const mockAdminStore = {
        useStore: () => ({ state: reactive({ isEditing: true }) }),
      }
      const mockResourcesStore = {
        useStore: () => ({
          state: reactive({}),
          isIriPublishableEquivalent: vi.fn().mockReturnValue(false),
        }),
      }
      return new ResourceStackManager(mockAdminStore as any, mockResourcesStore as any, {} as any)
    }

    test('calls resetStack(true) when fromContext is true', async () => {
      const manager = createEditingManager()
      const item = { iri: '/test', domElements: ref([]), childIris: ref([]) }
      ;(manager as any).currentResourceStack.value = [item]
      ;(manager as any).contextResourceStack.value = [item]
      const resetSpy = vi.spyOn(manager, 'resetStack')
      await manager.selectStackIndex(0, true)
      expect(resetSpy).toHaveBeenCalledWith(true)
    })

    test('does not call resetStack when fromContext is false', async () => {
      const manager = createEditingManager()
      const item = { iri: '/test', domElements: ref([]), childIris: ref([]) }
      ;(manager as any).currentResourceStack.value = [item]
      const resetSpy = vi.spyOn(manager, 'resetStack')
      await manager.selectStackIndex(0, false)
      expect(resetSpy).not.toHaveBeenCalled()
    })
  })

  describe('insertResourceStackItem', () => {
    function createManagerWithFindAll() {
      const mockAdminStore = {
        useStore: () => ({ state: reactive({ isEditing: true }) }),
      }
      const mockResourcesStore = {
        useStore: () => ({
          state: reactive({}),
          isIriPublishableEquivalent: vi.fn().mockReturnValue(false),
          findAllPublishableIris: vi.fn((iri: string) => [iri]),
        }),
      }
      return new ResourceStackManager(mockAdminStore as any, mockResourcesStore as any, {} as any)
    }

    function makeStackItem(iri: string, childIris: string[] = []) {
      return { iri, domElements: ref([]), childIris: ref(childIris) }
    }

    test('appends item to empty stack', () => {
      const manager = createManagerWithFindAll()
      const item = makeStackItem('/component/1')
      ;(manager as any).insertResourceStackItem(item, false)
      expect((manager as any).currentResourceStack.value).toContain(item)
    })

    test('inserts before existing item whose childIris include the new item', () => {
      const manager = createManagerWithFindAll()
      const parent = makeStackItem('/_/component_groups/grp1', ['/component/child1'])
      ;(manager as any).currentResourceStack.value = [parent]
      const child = makeStackItem('/component/child1')
      ;(manager as any).insertResourceStackItem(child, false)
      const stack = (manager as any).currentResourceStack.value
      expect(stack[0]).toBe(child)
      expect(stack[1]).toBe(parent)
    })
  })

  describe('redrawFocus', () => {
    test('does nothing when focusProxy is not set', () => {
      const { manager } = createResourceManager()
      expect(() => manager.redrawFocus()).not.toThrow()
    })

    test('calls redraw on focusProxy when set', () => {
      const { manager } = createResourceManager()
      const redrawFn = vi.fn()
      ;(manager as any).focusProxy = { redraw: redrawFn }
      manager.redrawFocus()
      expect(redrawFn).toHaveBeenCalledOnce()
    })
  })

  describe('removeFocusComponent (private)', () => {
    test('unmounts focusComponent and removes focusWrapper when both set', () => {
      const { manager } = createResourceManager()
      const unmount = vi.fn()
      const remove = vi.fn()
      ;(manager as any).focusComponent = { unmount }
      ;(manager as any).focusWrapper = { remove }
      ;(manager as any).focusProxy = {}
      ;(manager as any).removeFocusComponent()
      expect(unmount).toHaveBeenCalledOnce()
      expect(remove).toHaveBeenCalledOnce()
      expect((manager as any).focusComponent).toBeUndefined()
      expect((manager as any).focusProxy).toBeUndefined()
      expect((manager as any).focusWrapper).toBeUndefined()
    })

    test('handles when neither focusComponent nor focusWrapper is set', () => {
      const { manager } = createResourceManager()
      expect(() => (manager as any).removeFocusComponent()).not.toThrow()
    })
  })
})

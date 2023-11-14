import { describe, expect, test, vi } from 'vitest'
import { reactive, ref } from 'vue'
import ComponentManager from './component-manager'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    watch: vi.fn(() => {}) // mod.watch(...args)
  }
})

function createComponentManager (mockStore?: any) {
  const mockAdminStore = {
    useStore: () => mockStore || ({
      state: reactive({
        isEditing: false
      })
    })
  }

  const mockResourcesStore = {
    useStore: () => mockStore || ({
      state: reactive({})
    })
  }

  const manager = new ComponentManager(mockAdminStore, mockResourcesStore)
  return {
    manager,
    store: mockAdminStore
  }
}

describe('Component Manager', () => {
  test.todo('Constructor should initialise a watcher', () => {
    // todo: mock properly and ensure watcher is initialised with the correct function handlers
    vi.spyOn(ComponentManager.prototype, 'listenEditModeChange').mockImplementationOnce(() => {})
    vi.spyOn(ComponentManager.prototype, 'listenCurrentIri').mockImplementationOnce(() => {})
    const mockStore = { state: { isEditing: true } }
    const { manager } = createComponentManager(mockStore)
    expect(manager.listenEditModeChange).toHaveBeenCalledOnce()
    expect(manager.listenCurrentIri).toHaveBeenCalledOnce()
  })

  describe('adminStore getter', () => {
    test('should return reference to store', () => {
      const mockStore = { state: { isEditing: true } }
      const { manager } = createComponentManager(mockStore)

      expect(manager.adminStore).toEqual(mockStore)
    })
  })

  describe('isEditing getter', () => {
    test('should return current edit status flag', () => {
      const mockStore = { state: { isEditing: true } }
      const { manager } = createComponentManager(mockStore)

      expect(manager.isEditing).toEqual(mockStore.state.isEditing)

      mockStore.state.isEditing = false

      expect(manager.isEditing).toEqual(mockStore.state.isEditing)
    })
  })

  describe('resourceStack getter', () => {
    test.each([
      { lastClickTarget: ref({}), mockStack: ['anything'], expected: [] },
      { lastClickTarget: ref(null), mockStack: [1, 2, 3], expected: [1, 2, 3] }
    ])('If lastClickTarget is $lastClickTarget the stack should return $expected', ({ lastClickTarget, mockStack, expected }) => {
      const { manager } = createComponentManager()

      manager.lastClickTarget = ref(lastClickTarget)
      manager.currentResourceStack = ref(mockStack)

      expect(manager.resourceStack.value).toEqual(expected)
    })
  })

  describe('currentStackItem getter', () => {
    test.each([
      {
        stack: [{ test: true }, null, null],
        showManager: true,
        lastClickTarget: undefined,
        toEqual: { test: true }
      },
      {
        stack: [{ test: true }, null, null],
        showManager: false,
        lastClickTarget: undefined,
        toEqual: undefined
      },
      {
        stack: [{ test: true }, null, null],
        showManager: true,
        lastClickTarget: {},
        toEqual: undefined
      },
      {
        stack: [],
        showManager: true,
        lastClickTarget: undefined,
        toEqual: undefined
      }
    ])('should return first item from stack', ({ stack, showManager, lastClickTarget, toEqual }) => {
      const { manager } = createComponentManager()

      manager.showManager.value = showManager
      manager.lastClickTarget.value = lastClickTarget
      manager.currentResourceStack = ref(stack)

      expect(manager.currentStackItem.value).toEqual(toEqual)
    })
  })

  describe('stack operations', () => {
    describe('isItemAlreadyInStack', () => {
      test('should check whether item is in stack or not by iri', () => {
        const { manager } = createComponentManager()
        const mockIri = '/mock/iri'
        const mockStackItem = { iri: mockIri }

        manager.resourceStack.value.push(mockStackItem)

        expect(manager.isItemAlreadyInStack(mockIri)).toEqual(true)
        expect(manager.isItemAlreadyInStack('/random')).toEqual(false)
      })
    })

    describe('resetStack', () => {
      test('should reset stack and remove last click target', () => {
        const { manager } = createComponentManager()

        manager.currentResourceStack = ref([1, 2, 3])
        manager.lastClickTarget = ref('mock-target')

        manager.resetStack()

        expect(manager.resourceStack.value).toEqual([])
        expect(manager.lastClickTarget.value).toEqual(null)
      })
    })

    describe('addToStack', () => {
      test('should NOT add item to stack IF edit mode is off', () => {
        const mockStore = { state: { isEditing: false } }
        const { manager } = createComponentManager(mockStore)

        manager.addToStack({})

        expect(manager.resourceStack.value.length).toEqual(0)
      })

      test('should NOT add item to stack IF item with such iri already in stack', () => {
        const mockStore = { state: { isEditing: true } }
        const mockIri = '/mock'
        const { manager } = createComponentManager(mockStore)
        const mockTarget = { value: {} }

        manager.lastClickTarget = mockTarget
        manager.currentResourceStack.value = [{ iri: mockIri }]

        manager.addToStack({ iri: mockIri })

        expect(manager.resourceStack.value.length).toEqual(0)
        expect(manager.currentResourceStack.value.length).toEqual(1)
      })

      test('should reset and add item to stack IF item with same iri already in stack but no previous click target', () => {
        const mockStore = { state: { isEditing: true } }
        const mockIri = '/mock'
        const { manager } = createComponentManager(mockStore)
        const resetSpy = vi.spyOn(manager, 'resetStack')
        vi.spyOn(manager, 'insertResourceStackItem').mockImplementationOnce(() => {})
        manager.lastClickTarget = ref(null)
        manager.currentResourceStack = ref([{ iri: mockIri }])

        const event = { iri: mockIri, clickTarget: 'new' }
        manager.addToStack(event)
        expect(resetSpy).toHaveBeenCalledTimes(2)
        expect(resetSpy).toHaveBeenCalledWith(undefined)
        expect(resetSpy).toHaveBeenCalledWith(true)
        expect(manager.insertResourceStackItem).toHaveBeenCalledOnce()
        expect(manager.insertResourceStackItem).toHaveBeenCalledWith({ iri: mockIri }, undefined)
        expect(manager.lastClickTarget.value).toEqual('new')
      })

      test('should NOT add item to stack IF item has no iri', () => {
        const mockStore = { state: { isEditing: true } }
        const { manager } = createComponentManager(mockStore)
        vi.spyOn(manager, 'insertResourceStackItem').mockImplementationOnce(() => {})

        manager.addToStack({})
        expect(manager.insertResourceStackItem).not.toHaveBeenCalled()
      })

      test('should update last click target IF new click target is passed AND event has iri', () => {
        const mockStore = { state: { isEditing: true } }
        const { manager } = createComponentManager(mockStore)
        vi.spyOn(manager, 'insertResourceStackItem').mockImplementationOnce(() => {})
        const event = { iri: '/mock', clickTarget: { new: 'target' } }

        manager.lastClickTarget = ref({ old: 'target' })

        manager.addToStack(event)

        expect(manager.lastClickTarget.value).toEqual(event.clickTarget)
      })

      test('should clear the last click target IF event has no iri', () => {
        const mockStore = { state: { isEditing: true } }
        const { manager } = createComponentManager(mockStore)
        const resetSpy = vi.spyOn(manager, 'resetStack')
        manager.lastClickTarget = ref({ old: 'target' })
        manager.addToStack({})
        expect(resetSpy).not.toHaveBeenCalled()
        expect(manager.resourceStack.value.length).toEqual(0)
        expect(manager.lastClickTarget.value).toBeNull()
      })
    })

    describe('listenEditModeChange', () => {
      test.each([
        { newEditingState: false, showManager: false },
        { newEditingState: true, showManager: true }
      ])('When edit mode is changed from $initialEditingState to $newEditingState while manager is true, showManager should be $showManager', ({
        newEditingState,
        showManager
      }) => {
        const { manager } = createComponentManager()
        manager.showManager.value = true
        vi.clearAllMocks()

        // const resetStackSpy = vi.spyOn(manager, 'resetStack')
        manager.listenEditModeChange(newEditingState)
        expect(manager.showManager.value).toEqual(showManager)
        // expect(resetStackSpy).toHaveBeenCalledTimes(timesToCall)
      })
    })
  })
})

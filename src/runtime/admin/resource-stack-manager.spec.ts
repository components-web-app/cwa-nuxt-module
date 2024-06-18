import { describe, expect, test, vi } from 'vitest'
import { reactive, ref } from 'vue'
import ResourceStackManager from './resource-stack-manager'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    watch: vi.fn(() => {}) // mod.watch(...args)
  }
})

function createResourceManager (mockStore?: any) {
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

  const manager = new ResourceStackManager(mockAdminStore, mockResourcesStore)
  return {
    manager,
    store: mockAdminStore
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
      { currentClickTarget: ref(null), mockStack: [1, 2, 3], expected: [1, 2, 3] }
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
        toEqual: { test: true }
      },
      {
        stack: [{ test: true }, null, null],
        showManager: false,
        currentClickTarget: undefined,
        toEqual: undefined
      },
      {
        stack: [{ test: true }, null, null],
        showManager: true,
        currentClickTarget: {},
        toEqual: undefined
      },
      {
        stack: [],
        showManager: true,
        currentClickTarget: undefined,
        toEqual: undefined
      }
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

      test('should not reset and add item to stack IF item with same iri already in stack even if no previous click target', () => {
        const mockStore = { state: { isEditing: true } }
        const mockIri = '/mock'
        const { manager } = createResourceManager(mockStore)
        const resetSpy = vi.spyOn(manager, 'resetStack')
        vi.spyOn(manager, 'insertResourceStackItem').mockImplementationOnce(() => {})
        manager.currentClickTarget = ref(null)
        manager.currentResourceStack = ref([{ iri: mockIri }])

        const event = { iri: mockIri, clickTarget: 'new' }
        manager.addToStack(event)
        expect(resetSpy).toHaveBeenCalledTimes(0)
        // expect(resetSpy).toHaveBeenCalledWith(undefined)
        // expect(resetSpy).toHaveBeenCalledWith(true)
        expect(manager.insertResourceStackItem).toHaveBeenCalledTimes(0)
        // expect(manager.insertResourceStackItem).toHaveBeenCalledWith({ iri: mockIri }, undefined)
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
        { newEditingState: true, showManager: true }
      ])('When edit mode is changed from $initialEditingState to $newEditingState while manager is true, showManager should be $showManager', ({
        newEditingState,
        showManager
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
})

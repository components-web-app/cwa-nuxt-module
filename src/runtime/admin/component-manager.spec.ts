import { describe, expect, test, vi } from 'vitest'
import * as vue from 'vue'
import { nextTick, reactive } from 'vue'
import ComponentManager from './component-manager'

// vi.mock('./component-manager', async () => {
//   const actual = importActual()
// })

function createComponentManager (mockStore?: any) {
  const mockAdminStore = {
    useStore: () => mockStore || ({
      state: {
        isEditing: false
      }
    })
  }

  const manager = new ComponentManager(mockAdminStore)

  return {
    manager,
    store: mockAdminStore
  }
}

describe('Component Manager', () => {
  test('Constructor should initialise a watcher', () => {
    vi.spyOn(ComponentManager.prototype, 'listenEditModeChange').mockImplementationOnce(() => {})
    const mockStore = { state: { isEditing: true } }
    const { manager } = createComponentManager(mockStore)
    expect(manager.listenEditModeChange).toHaveBeenCalledOnce()
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
    test('should return stack', () => {
      const { manager } = createComponentManager()
      const mockStack = [1, 2, 3]

      manager.currentResourceStack = mockStack

      expect(manager.resourceStack).toEqual(mockStack)
    })
  })

  describe('currentStackItem getter', () => {
    test('should return first item from stack', () => {
      const { manager } = createComponentManager()
      const mockItem = { test: true }

      manager.currentResourceStack = [mockItem, null, null]

      expect(manager.currentStackItem).toEqual(mockItem)
    })
  })

  describe('stack operations', () => {
    describe('isItemAlreadyInStack', () => {
      test('should check whether item is in stack or not by iri', () => {
        const { manager } = createComponentManager()
        const mockIri = '/mock/iri'
        const mockStackItem = { iri: mockIri }

        manager.resourceStack.push(mockStackItem)

        expect(manager.isItemAlreadyInStack(mockIri)).toEqual(true)
        expect(manager.isItemAlreadyInStack('/random')).toEqual(false)
      })
    })

    describe('resetStack', () => {
      test('should reset stack and remove last click target', () => {
        const { manager } = createComponentManager()

        manager.currentResourceStack = [1, 2, 3]
        manager.lastClickTarget = 'mock-target'

        manager.resetStack()

        expect(manager.resourceStack).toEqual([])
        expect(manager.lastClickTarget).toEqual(null)
      })
    })

    describe('addToStack', () => {
      test('should NOT add item to stack IF edit mode is off', () => {
        const mockStore = { state: { isEditing: false } }
        const { manager } = createComponentManager(mockStore)

        manager.addToStack({})

        expect(manager.resourceStack.length).toEqual(0)
      })

      test('should NOT add item to stack IF item with such iri already in stack', () => {
        const mockStore = { state: { isEditing: true } }
        const mockIri = '/mock'
        const { manager } = createComponentManager(mockStore)

        manager.currentResourceStack = [{ iri: mockIri }]

        manager.addToStack({ iri: mockIri })

        expect(manager.resourceStack.length).toEqual(1)
      })

      test('should NOT add item to stack IF item has no iri AND click target is not new', () => {
        const mockStore = { state: { isEditing: true } }
        const { manager } = createComponentManager(mockStore)
        const mockTarget = {}

        manager.lastClickTarget = mockTarget

        manager.addToStack({ clickTarget: mockTarget })

        expect(manager.resourceStack.length).toEqual(0)
      })

      test('should update last click target IF new click target is passed AND event has iri', () => {
        const mockStore = { state: { isEditing: true } }
        const { manager } = createComponentManager(mockStore)
        const event = { iri: '/mock', clickTarget: { new: 'target' } }

        manager.lastClickTarget = { old: 'target' }

        manager.addToStack(event)

        expect(manager.lastClickTarget).toEqual(event.clickTarget)
      })

      test('should reset stack AND NOT add item to stack IF event has no iri', () => {
        const mockStore = { state: { isEditing: true } }
        const { manager } = createComponentManager(mockStore)
        const resetSpy = vi.spyOn(manager, 'resetStack')

        manager.addToStack({})

        expect(resetSpy).toHaveBeenCalled()
        expect(manager.resourceStack.length).toEqual(0)
      })
    })

    describe('listenEditModeChange', () => {
      test('Watch should be called', () => {
        const watchSpy = vi.spyOn(vue, 'watch')
        const mockStore = { state: { isEditing: true } }
        createComponentManager(mockStore)
        expect(watchSpy).toHaveBeenCalledOnce()
      })
      test('should reset stack IF edit mode is turned off', async () => {
        const mockStore = { state: reactive({ isEditing: true }) }
        const { manager } = createComponentManager(mockStore)
        const resetSpy = vi.spyOn(manager, 'resetStack')

        manager.listenEditModeChange()

        mockStore.state.isEditing = false

        await nextTick()

        expect(resetSpy).toHaveBeenCalled()
      })
    })
  })
})

import { describe, test, vi, expect, afterEach } from 'vitest'
import { computed, ref } from 'vue'
import { Mock } from '@vitest/spy'
import Cwa from '../cwa'
import * as ResourceUtils from '../resources/resource-utils'
import { CwaResourceTypes } from '../resources/resource-utils'
import ManageableComponent from './manageable-component'
import * as ManagerTabsResolver from '#cwa/runtime/admin/manager-tabs-resolver'

const Node = {
  ELEMENT_NODE: 1,
  ATTRIBUTE_NODE: 2,
  /** node is a Text node. */
  TEXT_NODE: 3,
  /** node is a CDATASection node. */
  CDATA_SECTION_NODE: 4,
  ENTITY_REFERENCE_NODE: 5,
  ENTITY_NODE: 6,
  /** node is a ProcessingInstruction node. */
  PROCESSING_INSTRUCTION_NODE: 7,
  /** node is a Comment node. */
  COMMENT_NODE: 8,
  /** node is a document. */
  DOCUMENT_NODE: 9,
  /** node is a doctype. */
  DOCUMENT_TYPE_NODE: 10,
  /** node is a DocumentFragment node. */
  DOCUMENT_FRAGMENT_NODE: 11,
  NOTATION_NODE: 12,
  /** Set when node and other are not in the same tree. */
  DOCUMENT_POSITION_DISCONNECTED: 0x01,
  /** Set when other is preceding node. */
  DOCUMENT_POSITION_PRECEDING: 0x02,
  /** Set when other is following node. */
  DOCUMENT_POSITION_FOLLOWING: 0x04,
  /** Set when other is an ancestor of node. */
  DOCUMENT_POSITION_CONTAINS: 0x08,
  /** Set when other is a descendant of node. */
  DOCUMENT_POSITION_CONTAINED_BY: 0x10,
  DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC: 0x20
}
vi.stubGlobal('Node', Node)

vi.mock('../cwa', () => {
  return {
    default: vi.fn(() => ({
      admin: {
        eventBus: {
          on: vi.fn(),
          off: vi.fn(),
          emit: vi.fn()
        },
        componentManager: {
          addToStack: vi.fn()
        }
      },
      resources: vi.fn()
    }))
  }
})

vi.mock('./manager-tabs-resolver', () => {
  return {
    default: vi.fn(() => ({
      resolve: vi.fn()
    }))
  }
})

interface DummyDom {
  nodeType: 1|2|3
  nextSibling?: DummyDom
  addEventListener?: Mock
}

function createDomElement (nodeType: 1|2|3): DummyDom {
  return {
    nodeType,
    nextSibling: null
  }
}

function createManageableComponent ($el?: DummyDom) {
  const component = {
    $el: $el || createDomElement(1)
  }
  const $cwa = new Cwa()
  return {
    instance: new ManageableComponent(component, $cwa),
    $cwa
  }
}

describe('ManageableComponent Class', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('ManagerTabsResolver is initialised with correct parameters', () => {
    createManageableComponent()
    expect(ManagerTabsResolver.default).toHaveBeenCalled()
  })

  test('componentMountedListener is bound to `this`', () => {
    const { instance } = createManageableComponent()
    // eslint-disable-next-line no-prototype-builtins
    expect(instance.componentMountedListener.hasOwnProperty('prototype')).toEqual(false)
    // eslint-disable-next-line no-prototype-builtins
    expect(instance.clickListener.hasOwnProperty('prototype')).toEqual(false)
  })

  describe('init function', () => {
    test('init functions are carried out', async () => {
      const vue = await import('vue')
      const watchSpy = vi.spyOn(vue, 'watch').mockImplementationOnce(() => 'unwatchFn')
      const { instance } = createManageableComponent()
      vi.spyOn(instance, 'clear').mockImplementationOnce(() => {})
      vi.spyOn(instance, 'iriWatchHandler').mockImplementationOnce(() => {})
      const newIri = ref('/new')
      instance.init(newIri)
      expect(instance.clear).toHaveBeenCalledWith(false)
      expect(instance.currentIri).toEqual(newIri)
      expect(instance.unwatchCurrentIri).toEqual('unwatchFn')
      expect(watchSpy.mock.lastCall[0]).toEqual(instance.currentIri)
      expect(Object.create(instance.iriWatchHandler.prototype) instanceof watchSpy.mock.lastCall[1]).toBe(true)
      expect(watchSpy.mock.lastCall[2]).toEqual({
        immediate: true,
        flush: 'post'
      })
    })
  })

  describe('iriWatchHandler function', () => {
    test.each([
      {
        currentIri: '/abc',
        clearCallCount: 1
      },
      {
        currentIri: undefined,
        clearCallCount: 1
      }
    ])('If currentIri is $currentIri then the `clear` function is called $clearCallCount times and currentIri is set', ({ currentIri, clearCallCount }) => {
      const { instance, $cwa } = createManageableComponent()
      instance.currentIri = ref(currentIri)
      vi.spyOn(instance, 'addClickEventListeners').mockImplementationOnce(() => {})
      vi.spyOn(instance, 'clear').mockImplementationOnce(() => {})
      const listener = vi.fn()
      vi.spyOn(instance, 'componentMountedListener', 'get').mockImplementationOnce(() => listener)

      instance.iriWatchHandler('/something')
      expect(instance.clear).toHaveBeenCalledTimes(clearCallCount)
      expect(instance.clear).toHaveBeenCalledWith(true)

      expect(instance.addClickEventListeners).toHaveBeenCalledTimes(1)
      expect($cwa.admin.eventBus.on).toHaveBeenCalledWith('componentMounted', listener)
      expect($cwa.admin.eventBus.emit).toHaveBeenCalledWith('componentMounted', '/something')
    })
  })

  describe('clear function', () => {
    test('If there is isInit is false clear functions will be skipped', () => {
      const { instance, $cwa } = createManageableComponent()
      vi.spyOn(instance, 'removeClickEventListeners').mockImplementationOnce(() => {})
      const domElements = [createDomElement(1)]
      instance.domElements = domElements
      instance.isInit = false
      instance.clear()

      expect($cwa.admin.eventBus.off).not.toHaveBeenCalled()
      expect(instance.removeClickEventListeners).not.toHaveBeenCalled()
      expect(instance.domElements).toEqual(domElements)
    })
    test.each([
      { soft: false },
      { soft: true }
    ])('clear functions are carried out', ({ soft }) => {
      const { instance, $cwa } = createManageableComponent()
      vi.spyOn(instance, 'removeClickEventListeners').mockImplementationOnce(() => {})

      const unwatchCurrentStackItem = vi.fn()
      const unwatchCurrentIri = vi.fn()
      instance.isInit = true
      instance.currentIri = ref('/abc')
      instance.domElements = [createDomElement(1)]
      instance.unwatchCurrentStackItem = unwatchCurrentStackItem
      instance.unwatchCurrentIri = unwatchCurrentIri
      instance.clear(soft)

      expect($cwa.admin.eventBus.off).toHaveBeenCalled()
      expect(instance.removeClickEventListeners).toHaveBeenCalled()
      expect(instance.domElements.value).toEqual([])
      expect(unwatchCurrentStackItem).toHaveBeenCalled()
      expect(instance.unwatchCurrentStackItem).toBeUndefined()

      if (soft) {
        expect(instance.currentIri.value).toEqual('/abc')
        expect(unwatchCurrentIri).not.toHaveBeenCalled()
        expect(instance.unwatchCurrentIri).toBe(unwatchCurrentIri)
      } else {
        expect(instance.currentIri.value).toBeUndefined()
        expect(unwatchCurrentIri).toHaveBeenCalled()
        expect(instance.unwatchCurrentIri).toBeUndefined()
      }
    })
  })

  describe('componentMountedListener function', () => {
    test.each([
      { iri: '/child', childIris: ['/child', '/another-child'], callCount: 1 },
      { iri: '/no-exist', childIris: ['/eeeerie'], callCount: 0 }
    ])('If iri passed is $iri with childIris as $childIris then functions should be called $callCount times', ({ iri, childIris, callCount }) => {
      const { instance } = createManageableComponent()
      vi.spyOn(instance, 'removeClickEventListeners').mockImplementationOnce(() => {})
      vi.spyOn(instance, 'addClickEventListeners').mockImplementationOnce(() => {})
      vi.spyOn(instance, 'childIris', 'get').mockImplementationOnce(() => computed(() => childIris))
      instance.componentMountedListener(iri)
      expect(instance.removeClickEventListeners).toHaveBeenCalledTimes(callCount)
      expect(instance.addClickEventListeners).toHaveBeenCalledTimes(callCount)
      if (callCount) {
        expect(instance.addClickEventListeners.mock.invocationCallOrder[0]).toBeGreaterThan(instance.removeClickEventListeners.mock.invocationCallOrder[0])
      }
    })
  })

  describe('childIris getter fn', () => {
    test('If there is no currentIri, and empty array is returned', () => {
      const { instance } = createManageableComponent()
      expect(instance.childIris.value).toEqual([])
    })

    test('A flat array of children is returned recursively', () => {
      const { instance, $cwa } = createManageableComponent()
      const getResource = vi.fn((iri: string) => {
        return computed(() => {
          let obj = { '@id': iri }
          if (iri === '/group') {
            obj = {
              ...obj,
              componentPositions: ['/position-1', '/position-2', '/position-3']
            }
          }
          if (iri === '/position-1') {
            obj = {
              ...obj
            }
          }
          if (iri === '/position-2') {
            obj = {
              ...obj,
              component: '/component'
            }
          }
          if (iri === '/position-3') {
            obj = {
              ...obj,
              component: '/no-type'
            }
          }
          if (iri === '/no-type') {
            obj = {
              ...obj,
              component: '/whatever'
            }
          }
          return {
            data: obj
          }
        })
      })

      vi.spyOn($cwa, 'resources', 'get').mockImplementation(() => {
        return {
          getResource
        }
      })
      vi.spyOn(ResourceUtils, 'getResourceTypeFromIri').mockImplementation((iri) => {
        if (iri === '/no-type') {
          return undefined
        }
        return iri.startsWith('/position') ? CwaResourceTypes.COMPONENT_POSITION : CwaResourceTypes.COMPONENT_GROUP
      })

      instance.currentIri = ref('/group')
      expect(instance.childIris.value).toEqual(['/position-1', '/position-1_placeholder', '/position-2', '/position-2_placeholder', '/component', '/position-3', '/position-3_placeholder', '/no-type'])
    })
  })

  describe('getAllEls function', () => {
    test('If the component does not have a root element return an empty array', () => {
      const { instance } = createManageableComponent()
      instance.component.$el = undefined
      const elementsArray = instance.getAllEls()
      expect(elementsArray).toEqual([])
    })

    test('If the component root element is a nodeType of 1 then return the element in the array (it is a singular div etc. and not a comment/text)', () => {
      const { instance } = createManageableComponent()
      const elementsArray = instance.getAllEls()
      expect(elementsArray).toEqual([instance.component.$el])
    })

    test('An array is returned of all siblings that do not have a nodeType of 3', () => {
      const { instance } = createManageableComponent()
      const rootElement = createDomElement(Node.ATTRIBUTE_NODE)
      rootElement.nextSibling = createDomElement(Node.TEXT_NODE)
      rootElement.nextSibling.nextSibling = createDomElement(Node.ELEMENT_NODE)
      rootElement.nextSibling.nextSibling.nextSibling = createDomElement(Node.ATTRIBUTE_NODE)

      instance.component.$el = rootElement
      const elementsArray = instance.getAllEls()
      expect(elementsArray).toEqual([
        rootElement,
        // rootElement.nextSibling, - SHOULD BE EXCLUDED FOR NODE TYPE
        rootElement.nextSibling.nextSibling,
        rootElement.nextSibling.nextSibling.nextSibling
      ])
    })
  })

  test('addClickEventListeners function', () => {
    const { instance } = createManageableComponent()
    const els = [
      {
        addEventListener: vi.fn()
      },
      {
        addEventListener: vi.fn()
      }
    ]
    vi.spyOn(instance, 'getAllEls').mockImplementationOnce(() => {
      return els
    })

    instance.addClickEventListeners()
    expect(instance.domElements.value).toEqual(els)
    expect(els[0].addEventListener).toHaveBeenCalledWith('click', instance.clickListener, false)
    expect(els[1].addEventListener).toHaveBeenCalledWith('click', instance.clickListener, false)
  })

  test('removeClickEventListeners function', () => {
    const { instance } = createManageableComponent()
    const els = [
      {
        removeEventListener: vi.fn()
      },
      {
        removeEventListener: vi.fn()
      }
    ]
    instance.domElements.value = els

    instance.removeClickEventListeners()
    expect(els[0].removeEventListener).toHaveBeenCalledWith('click', instance.clickListener)
    expect(els[1].removeEventListener).toHaveBeenCalledWith('click', instance.clickListener)
  })

  describe('clickListener', () => {
    test('should do nothing IF current iri is not set', () => {
      const { instance, $cwa } = createManageableComponent()

      instance.currentIri = null

      instance.clickListener({})

      expect($cwa.admin.componentManager.addToStack).not.toHaveBeenCalled()
    })

    test('should add to stack with correct object', () => {
      const resourceType = 'type'
      const resourceConfig = { managerTabs: ['abc'] }
      const resource = { iri: '/abc' }

      const { instance, $cwa } = createManageableComponent()
      const mockEvent = { target: 'mock' }
      const mockName = 'some name'
      const childIris = ['/child']

      vi.spyOn(instance, 'displayName', 'get').mockImplementationOnce(() => mockName)
      vi.spyOn(instance, 'resourceType', 'get').mockImplementationOnce(() => (resourceType))
      vi.spyOn(instance, 'resourceConfig', 'get').mockImplementationOnce(() => (resourceConfig))
      vi.spyOn(instance, 'currentResource', 'get').mockImplementation(() => (resource))
      vi.spyOn(instance, 'childIris', 'get').mockImplementationOnce(() => (childIris))

      vi.spyOn(ManagerTabsResolver.default.mock.results[0].value, 'resolve').mockImplementationOnce(() => (['abc']))

      instance.currentIri = ref('/mock')

      instance.clickListener(mockEvent)

      expect(ManagerTabsResolver.default.mock.results[0].value.resolve).toHaveBeenCalledWith({ resourceType, resourceConfig, resource })

      expect($cwa.admin.componentManager.addToStack).toHaveBeenCalledWith({
        iri: instance.currentIri.value,
        domElements: instance.domElements,
        clickTarget: mockEvent.target,
        displayName: mockName,
        managerTabs: ['abc'],
        childIris
      })
    })
  })

  describe.todo('resourceConfig getter', () => {

  })

  describe.todo('displayName getter', () => {
    test.todo('should add to stack with computed displayName', () => {
      const { instance, $cwa } = createManageableComponent()
      const mockEvent = { target: 'mock' }
      const mockName = 'some name'

      instance.currentIri = '/mock'

      instance.clickListener(mockEvent)

      expect($cwa.admin.componentManager.addToStack).toHaveBeenCalledWith({
        iri: instance.currentIri,
        domElements: instance.domElements,
        clickTarget: mockEvent.target,
        displayName: mockName
      })
    })
  })
})

// @vitest-environment happy-dom

import { describe, test, vi, expect, afterEach } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import type { Mock } from '@vitest/spy'
import * as vue from 'vue'
import Cwa from '../cwa'
import ManageableResource from './manageable-resource'
import * as ManagerTabsResolver from './manager-tabs-resolver'
import { getResourceTypeFromIri } from '#cwa/resources/resource-utils'

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
  DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC: 0x20,
}
vi.stubGlobal('Node', Node)

vi.mock('#cwa/resources/resource-utils', () => {
  return {
    getResourceTypeFromIri: vi.fn(() => 'resourceTypeResolved'),
    CwaResourceTypes: {
      COMPONENT: 'COMPONENT',
    },
  }
})

vi.mock('#cwa/storage/stores/resources/state', () => {
  return {
    NEW_RESOURCE_IRI: '__new__',
  }
})

vi.mock('../cwa', () => {
  return {
    default: vi.fn(function () {
      return {
        admin: {
          eventBus: {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
          },
          resourceStackManager: {
            addToStack: vi.fn(),
            currentStackItem: ref({ iri: '/something' }),
          },
        },
        resources: {
          findAllPublishableIris: vi.fn(iri => ([iri])),
          getResource: vi.fn(() => undefined),
          getChildIris: vi.fn(() => []),
        },
        resourcesManager: {
          addResourceEvent: ref(),
        },
        resourcesConfig: {},
      }
    }),
  }
})

vi.mock('./manager-tabs-resolver', () => {
  return {
    default: vi.fn(function () {
      return {
        resolve: vi.fn(),
      }
    }),
  }
})

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    watch: vi.fn(),
  }
})

const watchOnceMock = vi.fn()
vi.mock('@vueuse/core', () => ({
  watchOnce: (...args: any[]) => watchOnceMock(...args),
}))

vi.mock('consola', () => ({
  consola: {
    error: vi.fn(),
  },
}))

interface DummyDom {
  nodeValue?: string
  nodeType: 1 | 2 | 3
  nextSibling?: DummyDom
  addEventListener?: Mock
}

function createDomElement(nodeType: 1 | 2 | 3, nodeValue?: string): DummyDom {
  return {
    nodeValue,
    nodeType,
    nextSibling: null,
  }
}

function createManageableResource($el?: DummyDom) {
  const component = {
    $el: $el || createDomElement(1),
  }
  const $cwa = new Cwa()
  return {
    instance: new ManageableResource(component, $cwa, ref({ styles: { name: ['style'] } })),
    $cwa,
  }
}

describe('ManageableResource Class', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('ManagerTabsResolver is initialised with correct parameters', () => {
    createManageableResource()
    expect(ManagerTabsResolver.default).toHaveBeenCalled()
  })

  test('componentMountedListener is bound to `this`', () => {
    const { instance } = createManageableResource()
    // eslint-disable-next-line no-prototype-builtins
    expect(instance.componentMountedListener.hasOwnProperty('prototype')).toEqual(false)
    // eslint-disable-next-line no-prototype-builtins
    expect(instance.clickListener.hasOwnProperty('prototype')).toEqual(false)
  })

  describe('init function', () => {
    test('init functions are carried out', () => {
      const { instance } = createManageableResource()
      const watchSpy = vi.spyOn(vue, 'watch').mockImplementationOnce(() => 'unwatchFn')
      vi.spyOn(instance, 'clear').mockImplementationOnce(() => {})
      vi.spyOn(instance, '_initNewIri').mockImplementationOnce(() => {})
      const newIri = ref('/new')

      instance.init(newIri)

      expect(instance.clear).toHaveBeenCalledWith(false)
      expect(instance.currentIri).toEqual(newIri)
      expect(instance.unwatchCurrentIri).toEqual('unwatchFn')
      expect(watchSpy.mock.lastCall[0]).toEqual(instance.currentIri)
      expect(Object.create(instance._initNewIri.prototype) instanceof watchSpy.mock.lastCall[1]).toBe(true)
      expect(watchSpy.mock.lastCall[2]).toEqual({
        immediate: true,
        flush: 'post',
      })
    })
  })

  describe('initNewIri function', () => {
    test.each([
      {
        currentIri: '/abc',
        clearCallCount: 1,
      },
      {
        currentIri: undefined,
        clearCallCount: 1,
      },
    ])('If currentIri is `$currentIri` then the "clear" function is called `$clearCallCount` times and currentIri is set', ({ currentIri, clearCallCount }) => {
      const { instance } = createManageableResource()
      instance.currentIri = ref(currentIri)
      const localStackItem = { iri: '/something', localSomething: 'abc' }
      vi.spyOn(instance, 'getCurrentStackItem').mockImplementationOnce(() => localStackItem)
      vi.spyOn(instance, 'addClickEventListeners').mockImplementationOnce(() => {})
      vi.spyOn(instance, 'clear').mockImplementationOnce(() => {})
      const listener = vi.fn()
      vi.spyOn(instance, 'componentMountedListener', 'get').mockImplementationOnce(() => listener)

      instance.initNewIri('/something')

      expect(instance.clear).toHaveBeenCalledTimes(clearCallCount)
      expect(instance.clear).toHaveBeenCalledWith(true)

      expect(instance.addClickEventListeners).toHaveBeenCalledTimes(currentIri === undefined ? 0 : 1)
    })
  })

  describe('clear function', () => {
    test('If there is isIriInit is false clear functions will be skipped', () => {
      const { instance, $cwa } = createManageableResource()
      vi.spyOn(instance, 'removeClickEventListeners').mockImplementationOnce(() => {})
      const domElements = [createDomElement(1)]
      instance.domElements = domElements
      instance.isIriInit = false
      instance.clear()

      expect($cwa.admin.eventBus.off).not.toHaveBeenCalled()
      expect(instance.removeClickEventListeners).not.toHaveBeenCalled()
      expect(instance.domElements).toEqual(domElements)
    })
    test.each([
      { soft: false },
      { soft: true },
    ])('clear functions are carried out', ({ soft }) => {
      const { instance, $cwa } = createManageableResource()
      vi.spyOn(instance, 'removeClickEventListeners').mockImplementationOnce(() => {})

      const unwatchCurrentIri = vi.fn()
      instance.isIriInit = true
      instance.currentIri = ref('/abc')
      instance.domElements = [createDomElement(1)]
      instance.unwatchCurrentIri = unwatchCurrentIri

      // RUN FUNCTION
      instance.clear(soft)

      expect(instance.removeClickEventListeners).toHaveBeenCalled()
      expect(instance.domElements.value).toEqual([])

      if (soft) {
        expect(instance.currentIri.value).toEqual('/abc')
        expect(unwatchCurrentIri).not.toHaveBeenCalled()
        expect(instance.unwatchCurrentIri).toBe(unwatchCurrentIri)
      }
      else {
        expect($cwa.admin.eventBus.off).toHaveBeenCalled()
        expect(instance.currentIri).toBeUndefined()
        expect(unwatchCurrentIri).toHaveBeenCalled()
        expect(instance.unwatchCurrentIri).toBeUndefined()
      }
    })
  })

  describe('componentMountedListener function', () => {
    test.each([
      { iri: '/child', childIris: ['/child', '/another-child'], callCount: 1 },
      { iri: '/no-exist', childIris: ['/eeeerie'], callCount: 0 },
    ])('If iri passed is $iri with childIris as $childIris then functions should be called $callCount times', async ({ iri, childIris, callCount }) => {
      const { instance } = createManageableResource()
      instance.currentIri = ref('/abc')
      instance.isIriInit = true
      vi.spyOn(instance, 'removeClickEventListeners').mockImplementation(() => {})
      vi.spyOn(instance, 'addClickEventListeners').mockImplementation(() => {})
      vi.spyOn(instance, 'childIris', 'get').mockReturnValue(computed(() => childIris))
      instance.componentMountedListener(iri)
      await nextTick()
      expect(instance.removeClickEventListeners).toHaveBeenCalledTimes(callCount)
      expect(instance.addClickEventListeners).toHaveBeenCalledTimes(callCount)
      if (callCount) {
        expect(instance.addClickEventListeners.mock.invocationCallOrder[0]).toBeGreaterThan(instance.removeClickEventListeners.mock.invocationCallOrder[0])
      }
    })
  })

  describe('childIris getter fn', () => {
    test('If there is no currentIri, and empty array is returned', () => {
      const { instance } = createManageableResource()
      expect(instance.childIris.value).toEqual([])
    })
  })

  describe('getAllEls function', () => {
    test('If the component does not have a root element return an empty array', () => {
      const { instance } = createManageableResource()
      instance.component.$el = undefined
      const elementsArray = instance.getAllEls()
      expect(elementsArray).toEqual([])
    })

    test('If the component root element is a nodeType of 1 then return the element in the array (it is a singular div etc. and not a comment/text)', () => {
      const { instance } = createManageableResource()
      const elementsArray = instance.getAllEls()
      expect(elementsArray).toEqual([instance.component.$el])
    })

    test('An array is returned of all siblings that are element nodes', () => {
      const { instance } = createManageableResource()

      const elements = [
        createDomElement(Node.ELEMENT_NODE, 'EL0'),
        createDomElement(Node.ELEMENT_NODE, 'EL1'),
        createDomElement(Node.ELEMENT_NODE, 'EL2'),
        createDomElement(Node.ELEMENT_NODE, 'EL3'),
      ]

      const siblings = [
        createDomElement(Node.ATTRIBUTE_NODE, 'AN ATTR NODE'),
        elements[0],
        createDomElement(Node.COMMENT_NODE, 'cwa-start'),
        createDomElement(Node.TEXT_NODE),
        createDomElement(Node.COMMENT_NODE, 'cwa-start'),
        elements[1],
        createDomElement(Node.COMMENT_NODE, 'ANY COMMENT'),
        createDomElement(Node.COMMENT_NODE, 'cwa-end'),
        createDomElement(Node.ATTRIBUTE_NODE, 'AN ATTR NODE'),
        elements[2],
        createDomElement(Node.COMMENT_NODE, 'cwa-end'),
        elements[3],
      ]

      let previousSibling: DummyDom
      for (const sibling of siblings) {
        if (previousSibling) {
          previousSibling.nextSibling = sibling
        }
        previousSibling = sibling
      }

      instance.component.$el = siblings[0]
      const elementsArray = instance.getAllEls()
      expect(elementsArray).toEqual([
        elements[1],
        elements[2],
      ])
    })
  })

  test('addClickEventListeners function', () => {
    const { instance } = createManageableResource()
    const els = [
      {
        addEventListener: vi.fn(),
      },
      {
        addEventListener: vi.fn(),
      },
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
    const { instance } = createManageableResource()
    const els = [
      {
        removeEventListener: vi.fn(),
      },
      {
        removeEventListener: vi.fn(),
      },
    ]
    instance.domElements.value = els

    instance.removeClickEventListeners()
    expect(els[0].removeEventListener).toHaveBeenCalledWith('click', instance.clickListener)
    expect(els[1].removeEventListener).toHaveBeenCalledWith('click', instance.clickListener)
  })

  describe('clickListener', () => {
    test('should do nothing IF current iri is not set', () => {
      const { instance, $cwa } = createManageableResource()

      instance.currentIri = null

      instance.clickListener({})

      expect($cwa.admin.resourceStackManager.addToStack).not.toHaveBeenCalled()
    })

    test('should add to stack with correct object', () => {
      const resourceConfig = { managerTabs: ['abc'], ui: 'ui' }
      const resource = { iri: '/abc' }

      const { instance, $cwa } = createManageableResource()
      const mockEvent = { target: 'mock' }
      const mockName = 'some name'
      const childIris = ['/child']
      const styles = { name: ['style'] }

      vi.spyOn(instance, 'displayName', 'get').mockImplementationOnce(() => mockName)
      vi.spyOn(instance, 'resourceConfig', 'get').mockImplementation(() => (resourceConfig))
      vi.spyOn(instance, 'currentResource', 'get').mockImplementation(() => (resource))
      vi.spyOn(instance, 'childIris', 'get').mockImplementationOnce(() => (childIris))
      vi.spyOn(vue, 'computed').mockImplementationOnce(input => (input()))

      vi.spyOn(ManagerTabsResolver.default.mock.results[0].value, 'resolve').mockImplementationOnce(() => (['abc']))

      instance.currentIri = ref('/mock')

      instance.clickListener(mockEvent)

      expect(ManagerTabsResolver.default.mock.results[0].value.resolve).toHaveBeenCalledWith({ resourceType: 'resourceTypeResolved', resourceConfig, resource })

      expect($cwa.admin.resourceStackManager.addToStack).toHaveBeenCalledWith({
        iri: instance.currentIri.value,
        domElements: instance.domElements,
        clickTarget: mockEvent.target,
        displayName: mockName,
        managerTabs: ['abc'],
        ui: 'ui',
        styles,
        childIris,
      }, false, instance.ops)
    })

    // domElements is passed as the LIVE ref so ComponentFocus reacts to DOM changes while
    // a resource is selected (e.g. the user switches UI variant and new elements mount).
    //
    // Because it is live, consumers must NOT use :static based on resourceStack to keep
    // Headless UI containers open. resourceStack returns [] while a click is being processed,
    // causing isEditing to flicker false for one flush cycle — the container unmounts and
    // clears domElements before ComponentFocus can read them.
    //
    // The correct approach: let Headless UI open/close naturally. When the container is open
    // and the user clicks a child component, the click is captured before any close() fires.
    test('domElements is the live ref so ComponentFocus updates when DOM changes after selection', () => {
      const { instance, $cwa } = createManageableResource()

      vi.spyOn(instance, 'displayName', 'get').mockReturnValue('name')
      vi.spyOn(instance, 'resourceConfig', 'get').mockReturnValue(null)
      vi.spyOn(instance, 'currentResource', 'get').mockReturnValue({ iri: '/mock' })
      vi.spyOn(instance, 'childIris', 'get').mockReturnValue(computed(() => []))
      vi.spyOn(vue, 'computed').mockImplementationOnce(input => (input()))
      vi.spyOn(ManagerTabsResolver.default.mock.results[0].value, 'resolve').mockReturnValue([])

      const el1 = { nodeType: 1, id: 'el1' }
      instance.domElements.value = [el1]

      instance.currentIri = ref('/mock')
      instance.clickListener({ target: 'mock' })

      const [[passedStackItem]] = $cwa.admin.resourceStackManager.addToStack.mock.calls

      // Stack item holds the SAME ref — not a copy
      expect(passedStackItem.domElements).toBe(instance.domElements)

      // When addClickEventListeners() refreshes elements (e.g. after a UI variant switch
      // causes new DOM nodes to mount), the live ref propagates to ComponentFocus automatically
      const el2 = { nodeType: 1, id: 'el2' }
      instance.domElements.value = [el2]
      expect(passedStackItem.domElements.value).toEqual([el2])
    })

    test('should resolve resourceType as COMPONENT when iri is NEW_RESOURCE_IRI', () => {
      ;(getResourceTypeFromIri as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined)

      const resourceConfig = { managerTabs: [], ui: [] }
      const resource = { iri: '__new__' }
      const { instance } = createManageableResource()
      const mockEvent = { target: 'mock' }

      vi.spyOn(instance, 'displayName', 'get').mockImplementationOnce(() => 'name')
      vi.spyOn(instance, 'resourceConfig', 'get').mockImplementation(() => resourceConfig)
      vi.spyOn(instance, 'currentResource', 'get').mockImplementation(() => resource)
      vi.spyOn(instance, 'childIris', 'get').mockImplementationOnce(() => [])
      vi.spyOn(vue, 'computed').mockImplementationOnce(input => (input()))
      vi.spyOn(ManagerTabsResolver.default.mock.results[0].value, 'resolve').mockImplementationOnce(() => [])

      instance.currentIri = ref('__new__')
      instance.clickListener(mockEvent)

      expect(ManagerTabsResolver.default.mock.results[0].value.resolve).toHaveBeenCalledWith(
        expect.objectContaining({ resourceType: 'COMPONENT' }),
      )
    })
  })

  describe('elements getter', () => {
    test('returns the live domElements ref', () => {
      const { instance } = createManageableResource()
      expect(instance.elements).toBe(instance.domElements)
      const els = [createDomElement(1)]
      instance.domElements.value = els
      expect(instance.elements.value).toEqual(els)
    })
  })

  describe('componentMountedListener early returns', () => {
    test('does nothing when there is no currentIri', () => {
      const { instance } = createManageableResource()
      instance.currentIri = ref(undefined)
      const childIrisSpy = vi.spyOn(instance, 'childIris', 'get')
      instance.componentMountedListener('/something')
      expect(childIrisSpy).not.toHaveBeenCalled()
    })

    test('does nothing when the mounted iri equals the currentIri', () => {
      const { instance } = createManageableResource()
      instance.currentIri = ref('/abc')
      const childIrisSpy = vi.spyOn(instance, 'childIris', 'get')
      instance.componentMountedListener('/abc')
      expect(childIrisSpy).not.toHaveBeenCalled()
    })

    test('returns early when a child re-init is already pending', () => {
      const { instance } = createManageableResource()
      instance.currentIri = ref('/abc')
      instance.isIriInit = true
      instance.pendingChildMountedReInit = true
      const childIrisSpy = vi.spyOn(instance, 'childIris', 'get')
      instance.componentMountedListener('/child')
      expect(childIrisSpy).not.toHaveBeenCalled()
    })
  })

  describe('componentMountedListener placeholder handling', () => {
    test('expands placeholder iri to publishable iris and treats it as a child', async () => {
      const { instance, $cwa } = createManageableResource()
      instance.currentIri = ref('/abc')
      instance.isIriInit = true
      ;($cwa.resources as any).findAllPublishableIris.mockImplementation((iri: string) => [iri, '/published'])
      vi.spyOn(instance, 'childIris', 'get').mockReturnValue(computed(() => ['/published']))
      vi.spyOn(instance, 'removeClickEventListeners').mockImplementation(() => {})
      vi.spyOn(instance, 'addClickEventListeners').mockImplementation(() => {})

      instance.componentMountedListener('/child_placeholder')

      // placeholder iri itself + published iris from the stripped iri
      expect(($cwa.resources as any).findAllPublishableIris).toHaveBeenCalledWith('/child')
      // cascade emitted synchronously to grandparents with the currentIri
      expect($cwa.admin.eventBus.emit).toHaveBeenCalledWith('componentMounted', '/abc')

      await nextTick()
      expect(instance.removeClickEventListeners).toHaveBeenCalled()
      expect(instance.addClickEventListeners).toHaveBeenCalled()
      expect(instance.pendingChildMountedReInit).toBe(false)
    })

    test('nextTick callback returns early if currentIri cleared before flush', async () => {
      const { instance, $cwa } = createManageableResource()
      instance.currentIri = ref('/abc')
      instance.isIriInit = true
      vi.spyOn(instance, 'childIris', 'get').mockReturnValue(computed(() => ['/child']))
      vi.spyOn(instance, 'removeClickEventListeners').mockImplementation(() => {})
      vi.spyOn(instance, 'addClickEventListeners').mockImplementation(() => {})
      ;($cwa.resources as any).findAllPublishableIris.mockImplementation((iri: string) => [iri])

      instance.componentMountedListener('/child')
      // simulate the resource being cleared before nextTick flushes
      instance.isIriInit = false

      await nextTick()
      expect(instance.removeClickEventListeners).not.toHaveBeenCalled()
      expect(instance.addClickEventListeners).not.toHaveBeenCalled()
      expect(instance.pendingChildMountedReInit).toBe(false)
    })
  })

  describe('mockChildMounted function', () => {
    test('refreshes listeners and emits componentMounted with currentIri', () => {
      const { instance, $cwa } = createManageableResource()
      instance.currentIri = ref('/abc')
      vi.spyOn(instance, 'removeClickEventListeners').mockImplementation(() => {})
      vi.spyOn(instance, 'addClickEventListeners').mockImplementation(() => {})

      instance.mockChildMounted()

      expect(instance.removeClickEventListeners).toHaveBeenCalled()
      expect(instance.addClickEventListeners).toHaveBeenCalled()
      expect(instance.addClickEventListeners.mock.invocationCallOrder[0])
        .toBeGreaterThan(instance.removeClickEventListeners.mock.invocationCallOrder[0])
      expect($cwa.admin.eventBus.emit).toHaveBeenCalledWith('componentMounted', '/abc')
    })

    test('does not emit when there is no currentIri', () => {
      const { instance, $cwa } = createManageableResource()
      instance.currentIri = ref(undefined)
      vi.spyOn(instance, 'removeClickEventListeners').mockImplementation(() => {})
      vi.spyOn(instance, 'addClickEventListeners').mockImplementation(() => {})

      instance.mockChildMounted()

      expect(instance.removeClickEventListeners).toHaveBeenCalled()
      expect(instance.addClickEventListeners).toHaveBeenCalled()
      expect($cwa.admin.eventBus.emit).not.toHaveBeenCalled()
    })
  })

  describe('selectResourceListener function', () => {
    test('triggers a click when the selected iri matches currentIri', () => {
      const { instance } = createManageableResource()
      instance.currentIri = ref('/abc')
      const triggerSpy = vi.spyOn(instance, 'triggerClick').mockImplementation(() => Promise.resolve())
      instance.selectResourceListener('/abc')
      expect(triggerSpy).toHaveBeenCalled()
    })

    test('does nothing when the selected iri does not match currentIri', () => {
      const { instance } = createManageableResource()
      instance.currentIri = ref('/abc')
      const triggerSpy = vi.spyOn(instance, 'triggerClick').mockImplementation(() => Promise.resolve())
      instance.selectResourceListener('/other')
      expect(triggerSpy).not.toHaveBeenCalled()
    })
  })

  describe('childIris getter with currentIri set', () => {
    test('returns getChildIris result using the addResourceEvent', () => {
      const { instance, $cwa } = createManageableResource()
      instance.currentIri = ref('/abc')
      const addResourceEvent = { some: 'event' }
      ;($cwa.resourcesManager as any).addResourceEvent.value = addResourceEvent
      ;($cwa.resources as any).getChildIris.mockReturnValue(['/child-1', '/child-2'])

      expect(instance.childIris.value).toEqual(['/child-1', '/child-2'])
      expect(($cwa.resources as any).getChildIris).toHaveBeenCalledWith('/abc', addResourceEvent)
    })
  })

  describe('triggerClick function', () => {
    test('dispatches a click immediately when dom elements already exist', async () => {
      const { instance } = createManageableResource()
      const dispatchEvent = vi.fn()
      instance.domElements.value = [{ nodeType: 1, dispatchEvent }]

      await instance.triggerClick()

      expect(dispatchEvent).toHaveBeenCalledTimes(1)
      const dispatched = dispatchEvent.mock.calls[0][0]
      expect(dispatched.type).toBe('click')
      expect(dispatched.bubbles).toBe(true)
      expect(watchOnceMock).not.toHaveBeenCalled()
    })

    test('waits for dom elements to appear via watchOnce then dispatches', async () => {
      const { instance } = createManageableResource()
      instance.domElements.value = []
      const dispatchEvent = vi.fn()

      // watchOnce immediately invokes the callback simulating dom elements appearing
      watchOnceMock.mockImplementation((_source, cb) => {
        instance.domElements.value = [{ nodeType: 1, dispatchEvent }]
        cb(instance.domElements.value)
        return vi.fn()
      })

      await instance.triggerClick()

      expect(watchOnceMock).toHaveBeenCalled()
      expect(dispatchEvent).toHaveBeenCalledTimes(1)
    })

    test('watchOnce callback does not resolve while dom elements remain empty', async () => {
      const { instance } = createManageableResource()
      instance.domElements.value = []

      // callback invoked with an empty array should NOT resolve the promise
      watchOnceMock.mockImplementation((_source, cb) => {
        cb([])
        return vi.fn()
      })

      let settled = false
      const promise = instance.triggerClick().then(() => {
        settled = true
      })

      await nextTick()
      expect(settled).toBe(false)

      // now make elements appear and trigger the watch callback again
      const dispatchEvent = vi.fn()
      instance.domElements.value = [{ nodeType: 1, dispatchEvent }]
      const cb = watchOnceMock.mock.calls[0][1]
      cb(instance.domElements.value)

      await promise
      expect(settled).toBe(true)
      expect(dispatchEvent).toHaveBeenCalled()
    })

    test('logs an error when resolved but no dom element is found', async () => {
      const { consola } = await import('consola')
      const { instance } = createManageableResource()
      instance.currentIri = ref('/missing')
      instance.domElements.value = []

      // watchOnce resolves the promise but leaves domElements empty (length check passes
      // via a transient value that is reset before the await completes)
      watchOnceMock.mockImplementation((_source, cb) => {
        // resolve by reporting a non-empty array, but the actual ref stays empty
        cb([{ nodeType: 1 }])
        return vi.fn()
      })

      await instance.triggerClick()

      expect((consola.error as any)).toHaveBeenCalledWith(
        'Manageable resource listener called to select component, but no dom elements found.',
        '/missing',
      )
    })
  })

  describe('getCurrentStackItem error path', () => {
    test('throws when currentResource is not defined', () => {
      const { instance } = createManageableResource()
      vi.spyOn(instance, 'currentResource', 'get').mockReturnValue(undefined)
      instance.currentIri = ref('/abc')
      expect(() => instance.getCurrentStackItem(null)).toThrow(
        'Cannot get a currentStackItem when currentResource or currentIri is not defined',
      )
    })

    test('throws when currentIri is not defined', () => {
      const { instance } = createManageableResource()
      vi.spyOn(instance, 'currentResource', 'get').mockReturnValue({ iri: '/abc' })
      instance.currentIri = ref(undefined)
      expect(() => instance.getCurrentStackItem(null)).toThrow(
        'Cannot get a currentStackItem when currentResource or currentIri is not defined',
      )
    })
  })

  describe('resourceConfig getter no resourcesConfig', () => {
    test('returns undefined when $cwa.resourcesConfig is falsy', () => {
      const { instance, $cwa } = createManageableResource()
      ;($cwa.resources as any).getResource.mockReturnValue({ value: { data: { '@type': 'MyComponent' } } })
      ;($cwa as any).resourcesConfig = undefined
      instance.currentIri = ref('/component/1')
      expect((instance as any).resourceConfig).toBeUndefined()
    })
  })

  describe('currentResource getter', () => {
    test('returns undefined when currentIri is not set', () => {
      const { instance } = createManageableResource()
      instance.currentIri = ref(undefined)
      expect((instance as any).currentResource).toBeUndefined()
    })

    test('returns resource value when currentIri is set and getResource returns a ref', () => {
      const { instance, $cwa } = createManageableResource()
      const mockResource = { data: { '@type': 'MyComponent', '_metadata': { persisted: true } } }
      ;($cwa.resources as any).getResource.mockReturnValue({ value: mockResource })
      instance.currentIri = ref('/component/1')
      expect((instance as any).currentResource).toBe(mockResource)
    })

    test('returns undefined when getResource returns undefined', () => {
      const { instance, $cwa } = createManageableResource()
      ;($cwa.resources as any).getResource.mockReturnValue(undefined)
      instance.currentIri = ref('/component/1')
      expect((instance as any).currentResource).toBeUndefined()
    })
  })

  describe('resourceType getter', () => {
    test('returns undefined when currentResource is undefined', () => {
      const { instance, $cwa } = createManageableResource()
      ;($cwa.resources as any).getResource.mockReturnValue(undefined)
      instance.currentIri = ref('/component/1')
      expect((instance as any).resourceType).toBeUndefined()
    })

    test('returns data["@type"] from currentResource', () => {
      const { instance, $cwa } = createManageableResource()
      ;($cwa.resources as any).getResource.mockReturnValue({ value: { data: { '@type': 'MyComponent' } } })
      instance.currentIri = ref('/component/1')
      expect((instance as any).resourceType).toBe('MyComponent')
    })
  })

  describe('resourceConfig getter', () => {
    test('returns undefined when currentResource is undefined', () => {
      const { instance, $cwa } = createManageableResource()
      ;($cwa.resources as any).getResource.mockReturnValue(undefined)
      instance.currentIri = ref('/component/1')
      expect((instance as any).resourceConfig).toBeUndefined()
    })

    test('returns undefined when resourceType is not in resourcesConfig', () => {
      const { instance, $cwa } = createManageableResource()
      ;($cwa.resources as any).getResource.mockReturnValue({ value: { data: { '@type': 'UnknownType' } } })
      ;($cwa as any).resourcesConfig = {}
      instance.currentIri = ref('/component/1')
      expect((instance as any).resourceConfig).toBeUndefined()
    })

    test('returns config for the matching resourceType', () => {
      const { instance, $cwa } = createManageableResource()
      const config = { name: 'My Component', managerTabs: [] }
      ;($cwa.resources as any).getResource.mockReturnValue({ value: { data: { '@type': 'MyComponent' } } })
      ;($cwa as any).resourcesConfig = { MyComponent: config }
      instance.currentIri = ref('/component/1')
      expect((instance as any).resourceConfig).toBe(config)
    })
  })

  describe('displayName getter', () => {
    test('returns resourceType when resourceConfig has no name', () => {
      const { instance, $cwa } = createManageableResource()
      ;($cwa.resources as any).getResource.mockReturnValue({ value: { data: { '@type': 'MyComponent' } } })
      ;($cwa as any).resourcesConfig = { MyComponent: {} }
      instance.currentIri = ref('/component/1')
      expect((instance as any).displayName).toBe('MyComponent')
    })

    test('returns resourceConfig.name when set', () => {
      const { instance, $cwa } = createManageableResource()
      ;($cwa.resources as any).getResource.mockReturnValue({ value: { data: { '@type': 'MyComponent' } } })
      ;($cwa as any).resourcesConfig = { MyComponent: { name: 'Fancy Widget' } }
      instance.currentIri = ref('/component/1')
      expect((instance as any).displayName).toBe('Fancy Widget')
    })
  })

  describe.todo('resourceConfig getter', () => {

  })

  describe.todo('displayName getter', () => {
    test.todo('should add to stack with computed displayName', () => {
      const { instance, $cwa } = createManageableResource()
      const mockEvent = { target: 'mock' }
      const mockName = 'some name'

      instance.currentIri = '/mock'

      instance.clickListener(mockEvent)

      expect($cwa.admin.resourceStackManager.addToStack).toHaveBeenCalledWith({
        iri: instance.currentIri,
        domElements: instance.domElements,
        clickTarget: mockEvent.target,
        displayName: mockName,
      })
    })
  })
})

import { describe, test, vi, expect, afterEach } from 'vitest'
import { computed } from 'vue'
import Cwa from '../cwa'
import * as ResourceUtils from '../resources/resource-utils'
import { CwaResourceTypes } from '../resources/resource-utils'
import ManageableComponent from './manageable-component'

vi.mock('../cwa', () => {
  return {
    default: vi.fn(() => ({
      eventBus: {
        on: vi.fn(),
        off: vi.fn()
      },
      resources: vi.fn()
    }))
  }
})

function createDomElement (nodeType: 1|2|3) {
  return {
    nodeType,
    nextSibling: null,
    addEventListener: vi.fn()
  }
}

function createManageableComponent () {
  const component = {
    $el: createDomElement(1)
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

  test('componentMountedListener is bound to `this`', () => {
    const { instance } = createManageableComponent()
    // eslint-disable-next-line no-prototype-builtins
    expect(instance.componentMountedListener.hasOwnProperty('prototype')).toEqual(false)
  })

  describe('init function', () => {
    test.each([
      {
        currentIri: '/abc',
        clearCallCount: 1
      },
      {
        currentIri: undefined,
        clearCallCount: 0
      }
    ])('If currentIri is $currentIri then the `clear` function is called $clearCallCount times and currentIri is set', ({ currentIri, clearCallCount }) => {
      const { instance, $cwa } = createManageableComponent()
      instance.currentIri = currentIri
      vi.spyOn(instance, 'addClickEventListeners').mockImplementationOnce(() => {})
      vi.spyOn(instance, 'clear').mockImplementationOnce(() => {})
      const listener = vi.fn()
      vi.spyOn(instance, 'componentMountedListener', 'get').mockImplementationOnce(() => listener)

      instance.init('/something')
      expect(instance.clear).toHaveBeenCalledTimes(clearCallCount)
      expect(instance.currentIri).toEqual('/something')

      expect(instance.addClickEventListeners).toHaveBeenCalledTimes(1)
      expect($cwa.eventBus.on).toHaveBeenCalledWith('componentMounted', listener)
    })
  })

  describe('clear function', () => {
    test('If there is no currentIri the clear functions will not be executed', () => {
      const { instance, $cwa } = createManageableComponent()
      vi.spyOn(instance, 'removeClickEventListeners').mockImplementationOnce(() => {})
      const domElements = [createDomElement(1)]
      instance.domElements = domElements
      instance.clear()
      expect($cwa.eventBus.off).not.toHaveBeenCalled()
      expect(instance.removeClickEventListeners).not.toHaveBeenCalled()
      expect(instance.domElements).toEqual(domElements)
    })
    test('if there is a currentIri clear functions are carried out', () => {
      const { instance, $cwa } = createManageableComponent()
      vi.spyOn(instance, 'removeClickEventListeners').mockImplementationOnce(() => {})
      instance.currentIri = '/abc'
      instance.domElements = [createDomElement(1)]
      instance.clear()

      expect($cwa.eventBus.off).toHaveBeenCalled()
      expect(instance.removeClickEventListeners).toHaveBeenCalled()
      expect(instance.currentIri).toBeUndefined()
      expect(instance.domElements).toEqual([])
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
              componentPositions: ['/position-1', '/position-2']
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
        return iri.startsWith('/position') ? CwaResourceTypes.COMPONENT_POSITION : CwaResourceTypes.COMPONENT_GROUP
      })

      instance.currentIri = '/group'
      expect(instance.childIris.value).toEqual(['/position-1', '/position-2', '/component'])
    })
  })
})

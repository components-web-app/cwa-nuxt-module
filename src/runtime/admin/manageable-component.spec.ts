import { describe, test, vi, expect, afterEach } from 'vitest'
import Cwa from '../cwa'
import ManageableComponent from './manageable-component'

vi.mock('../cwa', () => {
  return {
    default: vi.fn(() => ({
      eventBus: {
        on: vi.fn(),
        off: vi.fn()
      }
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
})

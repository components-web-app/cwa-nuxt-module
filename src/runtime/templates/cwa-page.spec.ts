// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CwaPage from './cwa-page.vue'
import * as cwaComposable from '#cwa/runtime/composables/cwa'

const defaultIri = '12345'

describe('CWA page', () => {
  function createWrapper (iri = defaultIri) {
    // @ts-ignore
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
      resources: {
        pageIri: {
          value: iri
        }
      }
    }))

    return mount(CwaPage, {
      shallow: true
    })
  }

  test('should display ResourceLoader component IF pageIri is defined', () => {
    const wrapper = createWrapper()
    const child = wrapper.findComponent({ name: 'ResourceLoader' })
    const { iri, componentPrefix } = child.props()

    expect(child).toBeDefined()
    expect(iri).toEqual(defaultIri)
    expect(componentPrefix).toEqual('CwaPages')
  })

  describe('snapshots', () => {
    test('should display ResourceLoader component IF pageIri is defined', () => {
      const wrapper = createWrapper()

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should NOT display ResourceLoader IF pageIri is NOT defined', () => {
      const wrapper = createWrapper('')

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})

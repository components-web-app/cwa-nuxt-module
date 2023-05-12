import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import * as nuxt from '#app'
import CwaPage from './cwa-page.vue'

describe('CWA page', () => {
  function createWrapper (iri = '12345') {
    // @ts-ignore
    vi.spyOn(nuxt, 'useNuxtApp').mockImplementation(() => ({
      $cwa: {
        resources: {
          pageIri: {
            value: iri
          }
        }
      }
    }))

    const result = mount(CwaPage, {
      global: {
        stubs: {
          ResourceLoader: true
        }
      }
    })

    console.log(result)

    return result
  }

  test('should display ResourceLoader component IF pageIri is defined', () => {
    const wrapper = createWrapper()

    expect(wrapper.findComponent({ name: 'ResourceLoader' })).toBeDefined()
    expect(wrapper.element).toMatchSnapshot()
  })

  test('should NOT display ResourceLoader IF pageIri is NOT defined', () => {
    const wrapper = createWrapper('')

    expect(wrapper.element).toMatchSnapshot()
  })
})

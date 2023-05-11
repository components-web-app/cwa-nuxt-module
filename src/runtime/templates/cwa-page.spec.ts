import { describe, expect, test, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import * as nuxt from '#app'
import ResourceLoader from '../templates/components/core/ResourceLoader.vue'
import CwaPage from './cwa-page.vue'

function createWrapper (iri = '12345') {
  // @ts-ignore
  vi.spyOn(nuxt, 'useNuxtApp').mockImplementationOnce(() => ({
    $cwa: {
      resources: {
        pageIri: {
          value: iri
        }
      }
    }
  }))

  return shallowMount(CwaPage, {
    global: {
      stubs: {
        RecourceLoader: true
      }
    }
  })
}

describe('CWA page', () => {
  test('should display ResourceLoader component IF pageIri is defined', () => {
    const wrapper = createWrapper()

    expect(wrapper.findComponent(ResourceLoader)).toBeDefined()
    expect(wrapper.element).toMatchSnapshot()
  })

  test('should NOT display ResourceLoader IF pageIri is NOT defined', () => {
    const wrapper = createWrapper('')

    expect(wrapper.element).toMatchSnapshot()
  })
})

// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import * as nuxt from '#app'
import { mockComponent } from 'nuxt-vitest/utils'
import CwaPage from './cwa-page.vue'

const defaultIri = '12345'

describe('CWA page', () => {
  function createWrapper (iri = defaultIri) {
    mockComponent('./components/core/ResourceLoader', () => ({
      name: 'ResourceLoader',
      props: ['iri', 'componentPrefix']
    }))

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

    return shallowMount(CwaPage)
  }

  test('should display ResourceLoader component IF pageIri is defined', () => {
    const wrapper = createWrapper()
    const child = wrapper.findComponent({ name: 'ResourceLoader' })
    const { iri, componentPrefix } = child.props()

    expect(child).toBeDefined()
    expect(iri).toEqual(defaultIri)
    expect(componentPrefix).toEqual('CwaPages')
  })
})

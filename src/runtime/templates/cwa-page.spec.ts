import { describe, expect, test, vi } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
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

  console.log('check functions', shallowMount, mount)

  return mount(CwaPage, { shallow: true })
}

describe('CWA page', () => {
  test('should display ResourceLoader component IF pageIri is defined', () => {
    const wrapper = createWrapper()

    console.log('artur check', wrapper.html())

    expect(wrapper.findComponent(ResourceLoader)).toBeDefined()
    expect(wrapper.element).toMatchSnapshot()
  })

  test('should NOT display ResourceLoader IF pageIri is NOT defined', () => {
    const wrapper = createWrapper('')

    console.log('artur check', wrapper.html())

    expect(wrapper.element).toMatchSnapshot()
  })
})

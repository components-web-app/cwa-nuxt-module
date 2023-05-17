// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { mockComponent } from 'nuxt-vitest/utils'
import * as cwa from '../../../composables/cwaComponent'
import ComponentPosition from './ComponentPosition.vue'

const mockComponentName = 'test'

function createWrapper () {
  mockComponent('./ResourceLoader', () => ({
    name: 'ResourceLoader',
    props: ['iri', 'componentPrefix']
  }))

  // @ts-ignore
  vi.spyOn(cwa, 'useCwaResource').mockImplementation(() => ({
    value: {
      data: {
        component: mockComponentName
      }
    }
  }))

  return shallowMount(ComponentPosition, {
    props: {
      iri: mockComponentName
    }
  })
}

describe('ComponentPosition', () => {
  test('should display ResourceLoader component with componentIri', () => {
    const wrapper = createWrapper()
    const child = wrapper.findComponent({ name: 'ResourceLoader' })
    const { iri, componentPrefix } = child.props()

    expect(iri).toEqual(mockComponentName)
    expect(componentPrefix).toEqual('CwaComponents')
  })
})

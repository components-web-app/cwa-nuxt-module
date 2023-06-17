// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import * as cwaResourceComposables from '../../../composables/cwaResource'
import ComponentPosition from './ComponentPosition.vue'

const mockComponentName = 'test'

function createWrapper () {
  // @ts-ignore
  vi.spyOn(cwaResourceComposables, 'useCwaResourceUtils').mockImplementation(() => ({
    getResource: vi.fn(() => ref({ data: { component: mockComponentName } }))
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

  describe('snapshots', () => {
    test('should match snapshot with ResourceLoader component with componentIri', () => {
      const wrapper = createWrapper()

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})

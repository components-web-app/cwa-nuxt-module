// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import * as cwaComposable from '../../../composables/cwa'
import * as cwaResourceComposables from '../../../composables/cwa-resource'
import ComponentPosition from './ComponentPosition.vue'

const mockComponentIri = 'test'

function createWrapper () {
  // @ts-ignore
  vi.spyOn(cwaResourceComposables, 'useCwaResource').mockImplementation(() => ({
    getResource: vi.fn(() => ref({ data: { component: mockComponentIri, '@id': '/position-iri' } }))
  }))

  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    admin: {
      isEditing: false
    },
    resources: {
      findPublishedComponentIri: vi.fn(() => ref(mockComponentIri))
    }
  }))

  return shallowMount(ComponentPosition, {
    props: {
      iri: '/position-iri'
    }
  })
}

describe('ComponentPosition', () => {
  test('should display ResourceLoader component with componentIri', () => {
    const wrapper = createWrapper()
    const child = wrapper.findComponent({ name: 'ResourceLoader' })
    const { iri, componentPrefix } = child.props()

    expect(iri).toEqual(mockComponentIri)
    expect(componentPrefix).toEqual('CwaComponent')
  })

  describe('snapshots', () => {
    test('should match snapshot with ResourceLoader component with componentIri', () => {
      const wrapper = createWrapper()
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})

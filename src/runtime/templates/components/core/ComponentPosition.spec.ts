// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import * as cwaComposable from '../../../composables/cwa'
import * as cwaResourceComposables from '../../../composables/cwa-resource'
import * as cwaResourceManageableComposable from '../../../composables/cwa-resource-manageable'
import ComponentPosition from './ComponentPosition.vue'

const mockComponentIri = 'test'

function createWrapper() {
  // @ts-expect-error
  vi.spyOn(cwaResourceComposables, 'useCwaResource').mockImplementation(() => ({
    getResource: vi.fn(() => ref({ data: { 'component': mockComponentIri, '@id': '/position-iri' } })),
  }))
  vi.spyOn(cwaResourceManageableComposable, 'useCwaResourceManageable').mockImplementation(() => ({}))

  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    admin: {
      isEditing: false,
    },
    resources: {
      findPublishedComponentIri: vi.fn(() => ref(mockComponentIri)),
      getResource: vi.fn(() => undefined),
    },
    resourcesManager: {
      addResourceEvent: ref(undefined),
    },
  }))

  return shallowMount(ComponentPosition, {
    props: {
      iri: '/position-iri',
    },
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

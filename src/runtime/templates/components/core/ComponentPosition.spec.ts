// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import * as cwaComposable from '../../../composables/cwa'
import * as cwaResourceComposables from '../../../composables/cwa-resource'
import * as cwaResourceManageableComposable from '../../../composables/cwa-resource-manageable'
import ComponentPosition from './ComponentPosition.vue'

const mockComponentIri = 'test'

function createWrapper({ isAdmin = false, positionData = { 'component': mockComponentIri, '@id': '/position-iri' } as any, resolvedComponentIri = positionData?.component as string | undefined } = {}) {
  // @ts-expect-error
  vi.spyOn(cwaResourceComposables, 'useCwaResource').mockImplementation(() => ({
    getResource: vi.fn(() => ref({ data: positionData })),
  }))
  vi.spyOn(cwaResourceManageableComposable, 'useCwaResourceManageable').mockImplementation(() => ({}))

  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    auth: {
      isAdmin: computed(() => isAdmin),
    },
    admin: {
      isEditing: false,
    },
    resources: {
      positionComponentIri: vi.fn(() => computed(() => resolvedComponentIri)),
      findPublishedComponentIri: vi.fn((iri?: string) => ref(iri === mockComponentIri ? mockComponentIri : iri)),
      findDraftComponentIri: vi.fn(() => ref(undefined)),
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

  describe('placeholder when the position has no component', () => {
    const noComponent = { '@id': '/position-iri' }

    test('is NOT rendered for a non-admin', () => {
      const wrapper = createWrapper({ isAdmin: false, positionData: noComponent })
      expect(wrapper.findComponent({ name: 'ComponentPlaceholder' }).exists()).toBe(false)
      expect(wrapper.findComponent({ name: 'ResourceLoader' }).exists()).toBe(false)
    })

    test('is rendered for an admin', () => {
      const wrapper = createWrapper({ isAdmin: true, positionData: noComponent })
      expect(wrapper.findComponent({ name: 'ComponentPlaceholder' }).exists()).toBe(true)
    })

    test('is not rendered for an admin when the component resolves', () => {
      const wrapper = createWrapper({ isAdmin: true })
      expect(wrapper.findComponent({ name: 'ComponentPlaceholder' }).exists()).toBe(false)
      expect(wrapper.findComponent({ name: 'ResourceLoader' }).exists()).toBe(true)
    })
  })

  test('renders the component resolved for the displayed page, not the stored one from another path (#368)', () => {
    const wrapper = createWrapper({
      positionData: { '@id': '/position-iri', 'pageDataProperty': 'htmlContent', 'component': '/component/html_contents/previous-article' },
      resolvedComponentIri: '/component/html_contents/this-article',
    })
    expect(wrapper.findComponent({ name: 'ResourceLoader' }).props('iri')).toBe('/component/html_contents/this-article')
  })

  describe('snapshots', () => {
    test('should match snapshot with ResourceLoader component with componentIri', () => {
      const wrapper = createWrapper()
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})

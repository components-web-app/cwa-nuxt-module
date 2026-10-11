// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import { computed, defineComponent, h, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import * as cwaComposable from '../../../composables/cwa'
import * as cwaResourceComposables from '../../../composables/cwa-resource'
import * as cwaResourceManageableComposable from '../../../composables/cwa-resource-manageable'
import ComponentPosition from './ComponentPosition.vue'
import { ResourcesManager } from '#cwa/resources/resources-manager'
import { Resources } from '#cwa/resources/resources'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import { ErrorStore } from '#cwa/storage/stores/error/error-store'

const placeholderModule = vi.hoisted(() => ({ loads: 0 }))

vi.mock('./ComponentPlaceholder.vue', () => {
  placeholderModule.loads++
  return {
    __esModule: true,
    default: defineComponent({
      name: 'ComponentPlaceholder',
      props: ['iri', 'name'],
      setup: () => () => h('div', { class: 'placeholder' }),
    }),
  }
})

const mockComponentIri = 'test'

function createWrapper({ isAdmin = false, positionData = { 'component': mockComponentIri, '@id': '/position-iri' } as any, resolvedComponentIri = positionData?.component as string | undefined, mountFn = shallowMount } = {}) {
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

  return mountFn(ComponentPosition, {
    props: {
      iri: '/position-iri',
    },
  })
}

describe('ComponentPosition', () => {
  describe('the placeholder module', () => {
    test('is not loaded by a visitor\'s position, so it stays out of the visitor\'s page chunks (#382)', async () => {
      createWrapper({ isAdmin: false, positionData: { '@id': '/position-iri' } })
      createWrapper({ isAdmin: false })
      await flushPromises()
      expect(placeholderModule.loads).toBe(0)
    })

    test('is loaded and rendered when an admin sees a position with no component', async () => {
      const wrapper = createWrapper({ isAdmin: true, positionData: { '@id': '/position-iri' }, mountFn: mount })
      await vi.dynamicImportSettled()
      await flushPromises()
      expect(placeholderModule.loads).toBe(1)
      expect(wrapper.find('.placeholder').exists()).toBe(true)
    })
  })

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

  describe('editing after publishing while the browser clock is ahead of the API (#373)', () => {
    const liveIri = '/component/html_contents/live'
    const draftIri = '/component/html_contents/draft'
    const positionIri = '/_/component_positions/p1'

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    async function publishWithSkewedClock() {
      setActivePinia(createPinia())
      const resourcesStoreDef = new ResourcesStore('cwa')
      const resources = new Resources(resourcesStoreDef, new FetcherStore('cwa'))
      const cwaFetch = { fetch: vi.fn() }
      const resourcesManager = new ResourcesManager(
        cwaFetch as never,
        resourcesStoreDef,
        { primaryFetchPath: undefined } as never,
        new ErrorStore('cwa'),
        { fetchBatch: vi.fn().mockResolvedValue(undefined) } as never,
        { emptyStack: vi.fn(), resourceStackManager: { forcePublishedVersion: { value: undefined } } } as never,
        resources,
      )
      const store = resourcesStoreDef.useStore()
      store.saveResource({ resource: { '@id': liveIri, '@type': 'HtmlContent', 'draftResource': draftIri, 'componentPositions': [positionIri], '_metadata': { persisted: true, publishable: { published: true } } } as never })
      store.saveResource({ resource: { '@id': draftIri, '@type': 'HtmlContent', 'publishedResource': liveIri, 'publishedAt': null, '_metadata': { persisted: true, publishable: { published: false } } } as never })
      store.saveResource({ resource: { '@id': positionIri, '@type': 'ComponentPosition', 'component': liveIri, '_metadata': { persisted: true } } as never })
      cwaFetch.fetch.mockResolvedValue({
        '@id': draftIri,
        '@type': 'HtmlContent',
        'publishedResource': liveIri,
        'publishedAt': new Date(Date.now() + 500).toISOString(),
        '_metadata': { persisted: true, publishable: { published: false } },
      })
      await resourcesManager.updateResource({ endpoint: draftIri, data: { publishedAt: new Date().toISOString() } })
      expect(cwaFetch.fetch).toHaveBeenCalledTimes(1)
      return { resources, store }
    }

    test('does not render "has not been requested" for the position\'s component', async () => {
      const { resources, store } = await publishWithSkewedClock()
      // @ts-expect-error
      vi.spyOn(cwaResourceComposables, 'useCwaResource').mockImplementation(() => ({
        getResource: vi.fn(() => computed(() => store.current.byId[positionIri])),
      }))
      vi.spyOn(cwaResourceManageableComposable, 'useCwaResourceManageable').mockImplementation(() => ({}) as never)
      vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
        auth: { isAdmin: computed(() => true), user: { roles: [] }, signedIn: ref(true) },
        admin: { isEditing: true, resourceStackManager: { currentIri: ref(undefined) } },
        resources,
        resourcesManager: { addResourceEvent: ref(undefined) },
        fetchResource: vi.fn(),
        isStaticRender: false,
      }) as never)

      const wrapper = mount(ComponentPosition, {
        props: { iri: positionIri },
        global: {
          stubs: {
            ComponentPlaceholder: true,
            CwaUiAlertWarning: { template: '<div class="warning"><slot /></div>' },
          },
          components: {
            CwaComponentHtmlContent: { name: 'CwaComponentHtmlContent', props: ['iri'], template: '<div class="html-content">{{ iri }}</div>' },
          },
        },
      })
      await new Promise(resolve => setTimeout(resolve, 30))
      await flushPromises()

      const loaderIri = wrapper.findComponent({ name: 'ResourceLoader' }).props('iri')
      expect(loaderIri).toBe(draftIri)
      expect(wrapper.text()).not.toContain('has not been requested')
      expect(wrapper.find('.html-content').text()).toBe(draftIri)
    })
  })
})

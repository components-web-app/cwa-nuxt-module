// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createSSRApp, h, ref, transformVNodeArgs } from 'vue'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'
import ResourceLoader from './ResourceLoader.vue'
import { CwaAuthStatus } from '#cwa/api/auth'
import { CwaResourceApiStatuses } from '#cwa/storage/stores/resources/state'
import * as cwaComposables from '#cwa/composables/cwa'

const styleClasses = vi.hoisted(() => ({}) as Record<string, Record<string, string>>)
vi.mock('#build/cwa-styles', () => ({ styleClasses }))

const mockPrefix = 'TestComponent'
const mockIri = 'testIri'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    watch: vi.fn(() => {}),
  }
})

function createWrapper(resource?: any, status?: CwaAuthStatus, component?: any, isStaticRender = false, user: any = { roles: [] }) {
  // @ts-expect-error
  vi.spyOn(cwaComposables, 'useCwa').mockImplementationOnce(() => ({
    auth: {
      status: {
        value: status ?? CwaAuthStatus.SIGNED_IN,
      },
      user,
      signedIn: ref(!!user),
    },
    fetchResource: vi.fn(),
    resources: {
      getResource: vi.fn(() => ref(resource)),
    },
    isStaticRender,
  }))

  return mount(ResourceLoader, {
    shallow: true,
    props: {
      iri: mockIri,
      componentPrefix: mockPrefix,
      uiComponent: component,
    },
    global: {
      renderStubDefaultSlot: true,
      components: {
        GlobalComponent: {
          name: 'GlobalComponent',
          template: '<div> global </div>',
          props: ['iri'],
        },
      },
    },
  })
}

describe('ResourceLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('reactive variables', () => {
    describe('resourceLoadBuffering', () => {
      test('If the resource exists, resourceLoadBuffering should be false', () => {
        const wrapper = createWrapper({
          apiState: {
            status: CwaResourceApiStatuses.IN_PROGRESS,
          },
        })
        expect(wrapper.vm.resourceLoadBuffering).toEqual(false)
      })

      test('If the resource does not exist, resourceLoadBuffering should be true and then revert to false after 20ms', () => {
        vi.useFakeTimers()
        const wrapper = createWrapper(undefined)
        expect(wrapper.vm.resourceLoadBuffering).toEqual(true)
        vi.advanceTimersByTime(20)
        expect(wrapper.vm.resourceLoadBuffering).toEqual(false)
        vi.useRealTimers()
      })
    })

    describe('isLoading', () => {
      test.each([
        {
          resourceLoadBuffering: false,
          resource: {
            data: null,
            apiState: {
              status: CwaResourceApiStatuses.IN_PROGRESS,
            },
          },
          result: true,
        },
        {
          resourceLoadBuffering: false,
          resource: {
            data: undefined,
            apiState: {
              status: CwaResourceApiStatuses.SUCCESS,
            },
          },
          result: false,
        },
        {
          resourceLoadBuffering: false,
          resource: {
            data: { test: true },
            apiState: {
              status: CwaResourceApiStatuses.IN_PROGRESS,
            },
          },
          result: false,
        },
        {
          resourceLoadBuffering: true,
          resource: {
            data: { test: true },
            apiState: {
              status: CwaResourceApiStatuses.IN_PROGRESS,
            },
          },
          result: false,
        },
        {
          resourceLoadBuffering: true,
          resource: undefined,
          result: true,
        },
      ])('should return $result IF there resource is $resource and buffering is $resourceLoadBuffering', ({
        resource,
        result,
        resourceLoadBuffering,
      }) => {
        const wrapper = createWrapper(resource)
        wrapper.vm.resourceLoadBuffering = ref(resourceLoadBuffering)
        expect(wrapper.vm.isLoading).toEqual(result)
      })
    })

    describe('resourceUiComponent', () => {
      test('should return nothing IF no resource is present', () => {
        const wrapper = createWrapper({ data: null, apiState: {} })

        expect(wrapper.vm.resourceUiComponent).not.toBeDefined()
      })

      test('should return nothing IF resource data is empty', () => {
        const wrapper = createWrapper({
          data: null,
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS,
          },
        })

        expect(wrapper.vm.resourceUiComponent).not.toBeDefined()
      })

      test('should return component name consisting of prefix and name from resource property', () => {
        const mockComponentName = 'Test'
        const wrapper = createWrapper({
          data: {
            uiComponent: mockComponentName,
          },
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS,
          },
        })

        expect(wrapper.vm.resourceUiComponent).toEqual(mockPrefix + mockComponentName)
      })

      test('should return component name consisting of prefix and type from resource property', () => {
        const mockType = 'MType'
        const wrapper = createWrapper({
          data: {
            '@type': mockType,
          },
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS,
          },
        })

        expect(wrapper.vm.resourceUiComponent).toEqual(mockPrefix + mockType)
      })
    })

    describe('hasError', () => {
      test('should return true IF api status EQUALS to error', () => {
        const wrapper = createWrapper({
          apiState: {
            status: CwaResourceApiStatuses.ERROR,
            error: {},
          },
        })

        expect(wrapper.vm.hasError).toEqual(true)
      })

      test('should return false IF api status DOES NOT EQUAL to error', () => {
        const wrapper = createWrapper({
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS,
            error: {},
          },
        })

        expect(wrapper.vm.hasError).toEqual(false)
      })
    })

    describe('hasSilentError', () => {
      test('should return false IF hasError property is false', () => {
        const wrapper = createWrapper({
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS,
            error: {},
          },
        })

        expect(wrapper.vm.hasSilentError).toEqual(false)
      })

      test('should return false IF hasError property is true AND error status code is greater than 500', () => {
        const wrapper = createWrapper({
          apiState: {
            status: CwaResourceApiStatuses.ERROR,
            error: {
              statusCode: 501,
            },
          },
        })

        expect(wrapper.vm.hasSilentError).toEqual(false)
      })

      test('should return false IF hasError property is true AND error status code is less than 400', () => {
        const wrapper = createWrapper({
          apiState: {
            status: CwaResourceApiStatuses.ERROR,
            error: {
              statusCode: 399,
            },
          },
        })

        expect(wrapper.vm.hasSilentError).toEqual(false)
      })

      test('should return true IF hasError property is true AND error status code is within range of [400:500)', () => {
        const wrapper = createWrapper({
          apiState: {
            status: CwaResourceApiStatuses.ERROR,
            error: {
              statusCode: 401,
            },
          },
        })

        expect(wrapper.vm.hasSilentError).toEqual(true)
      })
    })

    describe('resolvedComponent', () => {
      test('should return value from props IF it is defined', () => {
        const mockUiComponent = { name: 'MockComponent', template: '<div>I am mock</div>' }
        const wrapper = createWrapper({
          data: null,
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS,
          },
        }, CwaAuthStatus.SIGNED_IN, mockUiComponent)

        expect(wrapper.vm.resolvedComponent).toEqual(mockUiComponent)
      })
    })
  })

  describe('methods', () => {
    describe('fetchResource', () => {
      test('should NOT fetch resource IF ssr flag for api state is false', async () => {
        const resource = { apiState: { ssr: false } }
        const wrapper = createWrapper(resource)

        await wrapper.vm.methods.fetchResource()

        expect(wrapper.vm.$cwa.fetchResource).not.toHaveBeenCalled()
      })

      test('should NOT fetch resource IF ssr flag for api state is true AND resource has data', async () => {
        const resource = { apiState: { ssr: true }, data: { mock: true } }
        const wrapper = createWrapper(resource)

        await wrapper.vm.methods.fetchResource()

        expect(wrapper.vm.$cwa.fetchResource).not.toHaveBeenCalled()
      })

      test('should NOT fetch resource IF ssr flag for api state is true AND resource has no data AND no silent error', async () => {
        const resource = { apiState: { ssr: true, status: CwaResourceApiStatuses.SUCCESS }, data: undefined }
        const wrapper = createWrapper(resource)

        await wrapper.vm.methods.fetchResource()

        expect(wrapper.vm.$cwa.fetchResource).not.toHaveBeenCalled()
      })

      test('should fetch resource IF resource data is empty, silent error occurred, resource was fetched during SSR AND the visitor is signed in', async () => {
        const resource = { apiState: { ssr: true, error: { statusCode: 404 }, status: CwaResourceApiStatuses.ERROR }, data: undefined }
        const wrapper = createWrapper(resource)

        await wrapper.vm.methods.fetchResource()

        expect(wrapper.vm.$cwa.fetchResource).toHaveBeenCalledWith({ path: mockIri })
      })

      test('should NOT fetch resource IF resource data is empty, silent error occurred, resource was fetched during SSR AND the visitor is signed out', async () => {
        const resource = { apiState: { ssr: true, error: { statusCode: 404 }, status: CwaResourceApiStatuses.ERROR }, data: undefined }
        const wrapper = createWrapper(resource, undefined, undefined, false, null)

        await wrapper.vm.methods.fetchResource()

        expect(wrapper.vm.$cwa.fetchResource).not.toHaveBeenCalled()
      })

      test('should fetch resource IF resource data is empty, silent error occurred, resource was fetched during SSR AND the render is static', async () => {
        const resource = { apiState: { ssr: true, error: { statusCode: 404 }, status: CwaResourceApiStatuses.ERROR }, data: undefined }
        const wrapper = createWrapper(resource, undefined, undefined, true, null)

        await wrapper.vm.methods.fetchResource()

        expect(wrapper.vm.$cwa.fetchResource).toHaveBeenCalledWith({ path: mockIri })
      })
    })
  })

  describe('static render re-fetch', () => {
    const ssrSuccess = (extra: any = {}) => ({
      apiState: { ssr: true, status: CwaResourceApiStatuses.SUCCESS, fetchedAt: (new Date()).getTime(), ...extra },
      data: { mock: true },
    })

    test('re-fetches an SSR resource on mount when the render is static', () => {
      const wrapper = createWrapper(ssrSuccess(), undefined, undefined, true)
      expect(wrapper.vm.$cwa.fetchResource).toHaveBeenCalledWith({ path: mockIri })
    })

    test('does NOT re-fetch on a live SSR render, however old fetchedAt looks', () => {
      const wrapper = createWrapper(ssrSuccess({ fetchedAt: (new Date()).getTime() - 60000 }), undefined, undefined, false)
      expect(wrapper.vm.$cwa.fetchResource).not.toHaveBeenCalled()
    })

    test('does NOT re-fetch a resource that was already fetched client-side, even on a static render', () => {
      const wrapper = createWrapper(ssrSuccess({ ssr: false }), undefined, undefined, true)
      expect(wrapper.vm.$cwa.fetchResource).not.toHaveBeenCalled()
    })

    test('does NOT re-fetch a resource that has not successfully loaded', () => {
      const wrapper = createWrapper(ssrSuccess({ status: CwaResourceApiStatuses.IN_PROGRESS }), undefined, undefined, true)
      expect(wrapper.vm.$cwa.fetchResource).not.toHaveBeenCalled()
    })
  })

  describe('watch', () => {
    test('should be called with correct callback and options', () => {
      const watchSpy = vue.watch
      const wrapper = createWrapper({
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS,
        },
      })

      expect(watchSpy.mock.calls[0][0]).toHaveLength(3)
      expect(watchSpy.mock.calls[0][0][0].value).toEqual(wrapper.vm.hasSilentError)
      expect(watchSpy.mock.calls[0][0][1].value).toEqual(wrapper.vm.resource)
      expect(watchSpy.mock.calls[0][0][2].value).toEqual(true)
      // expect(watchSpy.mock.calls[0][0]).toEqual([wrapper.vm.hasSilentError, wrapper.vm.resource])
      expect(watchSpy.mock.calls[0][1]).toEqual(wrapper.vm.methods.fetchResource)
      expect(watchSpy.mock.calls[0][2]).toEqual({ immediate: true })
    })
  })

  describe('snapshots', () => {
    test('should match snapshot IF resource is loading', () => {
      const wrapper = createWrapper({ data: null, apiState: { status: CwaResourceApiStatuses.IN_PROGRESS } })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF resource does not exist after loading', async () => {
      vi.useFakeTimers()
      const wrapper = createWrapper(undefined)
      await vi.advanceTimersByTimeAsync(20)
      expect(wrapper.element).toMatchSnapshot()
      vi.useRealTimers()
    })

    test('should match snapshot IF resource data is not resolved', () => {
      const wrapper = createWrapper({
        data: null,
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
        },
      })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF UI component is not resolved', () => {
      const wrapper = createWrapper({
        data: {
          uiComponent: 'Mock',
        },
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
        },
      })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should show error warning for non-silent (5xx) resource errors', () => {
      const wrapper = createWrapper({
        data: undefined,
        apiState: {
          status: CwaResourceApiStatuses.ERROR,
          error: { statusCode: 500, statusMessage: 'Internal Server Error' },
        },
      })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should NOT show error warning for silent (4xx) resource errors', () => {
      const wrapper = createWrapper({
        data: undefined,
        apiState: {
          status: CwaResourceApiStatuses.ERROR,
          error: { statusCode: 404, statusMessage: 'Not Found' },
        },
      })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF component is resolved from props', async () => {
      const wrapper = createWrapper({
        data: {
          uiComponent: 'DummyComponent',
        },
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
        },
      })

      await wrapper.setProps({
        uiComponent: {
          name: 'DummyComponent',
          template: '<div> test </div>',
          props: ['iri'],
        },
      })

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF global component name is resolved', async () => {
      const wrapper = createWrapper({
        data: {
          uiComponent: 'GlobalComponent',
        },
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
        },
      })
      await wrapper.setProps({
        componentPrefix: undefined,
      })

      expect(wrapper.element).toMatchSnapshot()
    })
  })

  describe('server render of style keys (#453)', () => {
    const rendered = (name: string) => ({ name, props: ['iri'], render: () => h('div', { class: 'root' }, name) })

    function renderResource(data: Record<string, unknown>, componentPrefix: string, componentNames: string[]) {
      // @ts-expect-error
      vi.spyOn(cwaComposables, 'useCwa').mockImplementation(() => ({
        auth: { user: undefined, signedIn: ref(false) },
        fetchResource: vi.fn(),
        resources: {
          getResource: vi.fn(() => ref({ data, apiState: { status: CwaResourceApiStatuses.SUCCESS } })),
        },
        isStaticRender: false,
      }))
      const app = createSSRApp(ResourceLoader, { iri: '/component/1', componentPrefix })
      for (const name of componentNames) {
        app.component(name, rendered(name))
      }
      return renderToString(app)
    }

    function setStyles(styles: Record<string, Record<string, string>>) {
      for (const name of Object.keys(styleClasses)) {
        delete styleClasses[name]
      }
      Object.assign(styleClasses, structuredClone(styles))
    }

    beforeEach(() => {
      transformVNodeArgs()
      setStyles({
        CwaComponentHero: { 'black-bg': 'bg-black text-white', 'wide': 'w-full' },
        CwaComponentHeroUiTall: { tall: 'h-screen' },
        CwaComponentCard: { 'black-bg': 'bg-neutral-900' },
        CwaPagePrimary: { big: 'text-2xl' },
      })
    })

    test('the server-rendered HTML carries the resolved classes for the stored keys', async () => {
      const html = await renderResource({ '@type': 'Hero', 'uiClassNames': ['style:black-bg', 'style:wide'] }, 'CwaComponent', ['CwaComponentHero'])

      expect(html).toBe('<div class="root bg-black text-white w-full">CwaComponentHero</div>')
    })

    test('the same key resolves against each component type\'s own styles', async () => {
      const html = await renderResource({ '@type': 'Card', 'uiClassNames': ['style:black-bg'] }, 'CwaComponent', ['CwaComponentCard'])

      expect(html).toBe('<div class="root bg-neutral-900">CwaComponentCard</div>')
    })

    test('keys resolve against the rendered UI variant\'s styles, and switching back restores the classes', async () => {
      const data = { '@type': 'Hero', 'uiComponent': 'CwaComponentHeroUiTall', 'uiClassNames': ['style:black-bg', 'style:tall'] }
      const components = ['CwaComponentHero', 'CwaComponentHeroUiTall']

      expect(await renderResource(data, 'CwaComponent', components)).toBe('<div class="root h-screen">CwaComponentHeroUiTall</div>')

      const withoutTall = { ...data, uiClassNames: ['style:black-bg'] }
      expect(await renderResource(withoutTall, 'CwaComponent', components)).toBe('<div class="root">CwaComponentHeroUiTall</div>')
      expect(withoutTall.uiClassNames).toEqual(['style:black-bg'])

      expect(await renderResource({ ...withoutTall, uiComponent: null }, 'CwaComponent', components)).toBe('<div class="root bg-black text-white">CwaComponentHero</div>')
    })

    test('an unknown key or an entry without the prefix renders no classes', async () => {
      const html = await renderResource({ '@type': 'Hero', 'uiClassNames': ['style:nope', 'bg-black text-white'] }, 'CwaComponent', ['CwaComponentHero'])

      expect(html).toBe('<div class="root">CwaComponentHero</div>')
    })

    test('changing the generated styles changes the rendered classes with no save', async () => {
      const data = { '@type': 'Hero', 'uiClassNames': ['style:black-bg'] }
      expect(await renderResource(data, 'CwaComponent', ['CwaComponentHero'])).toBe('<div class="root bg-black text-white">CwaComponentHero</div>')

      setStyles({ CwaComponentHero: { 'black-bg': 'bg-red-500' } })

      expect(await renderResource(data, 'CwaComponent', ['CwaComponentHero'])).toBe('<div class="root bg-red-500">CwaComponentHero</div>')
    })

    test('a page resolves its own keys the same way', async () => {
      const html = await renderResource({ '@type': 'Page', 'uiComponent': 'CwaPagePrimary', 'uiClassNames': ['style:big'] }, 'CwaPage', ['CwaPagePrimary'])

      expect(html).toBe('<div class="root text-2xl">CwaPagePrimary</div>')
    })
  })
})

// @vitest-environment happy-dom

import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, getCurrentInstance, shallowRef, useTemplateRef, h } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: vi.fn(() => ({
    resources: {
      getResource: vi.fn(() => ({ value: undefined })),
    },
    admin: {
      isEditing: false,
      resourceStackManager: {
        forcePublishedVersion: { value: undefined },
      },
    },
  })),
}))

const prodUseTemplateRef = (key: string) => {
  const i = getCurrentInstance() as unknown as { refs: Record<string, unknown> } | null
  const r = shallowRef(null)
  if (i) {
    const refs = Object.isExtensible(i.refs) ? i.refs : (i.refs = {})
    Object.defineProperty(refs, key, {
      enumerable: true,
      get: () => r.value,
      set: (val: unknown) => (r.value = val as null),
    })
  }
  return r
}

describe('#267 duplicate template-ref registration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('vue')
  })

  describe('production build (faithful prod useTemplateRef — reproduces the real TypeError)', () => {
    async function withProdVue<T>(fn: (mod: typeof import('vue')) => Promise<T> | T) {
      vi.doMock('vue', async () => {
        const mod = await vi.importActual<typeof import('vue')>('vue')
        return { ...mod, useTemplateRef: prodUseTemplateRef }
      })
      vi.resetModules()
      const vue = await import('vue')
      return await fn(vue)
    }

    test('the prod defineProperty semantics this bug hinges on', () => {
      const refs: Record<string, unknown> = {}
      const def = (k: string) => Object.defineProperty(refs, k, { enumerable: true, get: () => null, set: () => {} })
      def('file')
      expect(() => def('file')).toThrow(/Cannot redefine property: file/)
    })

    test('useCwaFileField twice with a defaulted fileProp does not throw', async () => {
      await withProdVue(async () => {
        const { useCwaFileField } = await import('#cwa/composables/cwa-file-field')

        const Comp = defineComponent({
          setup() {
            useCwaFileField({ iri: '/resource/1' }, { imagineFilterName: 'thumbnail' })
            useCwaFileField({ iri: '/resource/1' }, { imagineFilterName: 'general' })
            return () => h('div')
          },
        })

        expect(() => mount(Comp)).not.toThrow()
      })
    })

    test('withFile twice with the same fileProp does not throw', async () => {
      await withProdVue(async () => {
        const { withFile } = await import('#cwa/composables/cwa-file-plugin')
        const { ref, computed } = await import('vue')

        const ctx = {
          iri: ref('/resource/1'),
          resource: computed(() => undefined),
          $cwa: {} as never,
        }

        const Comp = defineComponent({
          setup() {
            withFile({ imagineFilterName: 'thumbnail' })(ctx as never)
            withFile({ imagineFilterName: 'general' })(ctx as never)
            return () => h('div')
          },
        })

        expect(() => mount(Comp)).not.toThrow()
      })
    })
  })

  describe('explicit imageRef contract (real component + real DOM)', () => {
    function mockCachedImages() {
      const proto = window.HTMLImageElement.prototype
      vi.spyOn(proto, 'complete', 'get').mockReturnValue(true)
      vi.spyOn(proto, 'naturalHeight', 'get').mockReturnValue(120)
    }

    afterEach(() => {
      vi.restoreAllMocks()
    })

    test('a bare <img> that was already cached auto-loads on mount', async () => {
      mockCachedImages()
      const { useCwaFileField } = await import('#cwa/composables/cwa-file-field')

      const Comp = defineComponent({
        setup() {
          const imageRef = useTemplateRef('file')
          const { loaded } = useCwaFileField({ iri: '/resource/1' }, { imageRef })
          return { loaded }
        },
        template: `<img ref="file" src="/cached.jpg">`,
      })

      const wrapper = mount(Comp)
      expect(wrapper.vm.loaded).toBe(true)
    })

    test('a component wrapping an <img> (the NuxtImg shape) auto-loads via $el', async () => {
      mockCachedImages()
      const { useCwaFileField } = await import('#cwa/composables/cwa-file-field')

      const ImgComponent = defineComponent({
        props: { src: { type: String, default: '' } },
        template: `<img :src="src">`,
      })

      const Comp = defineComponent({
        components: { ImgComponent },
        setup() {
          const imageRef = useTemplateRef('file')
          const { loaded } = useCwaFileField({ iri: '/resource/1' }, { imageRef })
          return { loaded }
        },
        template: `<ImgComponent ref="file" src="/cached.jpg" />`,
      })

      const wrapper = mount(Comp)
      expect(wrapper.vm.loaded).toBe(true)
    })

    test('omitting imageRef opts out of the check entirely — even for a cached <img>', async () => {
      mockCachedImages()
      const { useCwaFileField } = await import('#cwa/composables/cwa-file-field')

      const Comp = defineComponent({
        setup() {
          const { loaded, handleLoad } = useCwaFileField({ iri: '/resource/1' })
          return { loaded, handleLoad }
        },
        template: `<img ref="file" src="/cached.jpg">`,
      })

      const wrapper = mount(Comp)
      expect(wrapper.vm.loaded).toBe(false)
      wrapper.vm.handleLoad()
      expect(wrapper.vm.loaded).toBe(true)
    })
  })

  describe('development build (real Vue — asserts the same branch never triggers)', () => {
    test('useCwaFileField twice emits no duplicate-key warning', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { useCwaFileField } = await import('#cwa/composables/cwa-file-field')

      const Comp = defineComponent({
        setup() {
          useCwaFileField({ iri: '/resource/1' }, { imagineFilterName: 'thumbnail' })
          useCwaFileField({ iri: '/resource/1' }, { imagineFilterName: 'general' })
          return () => h('div')
        },
      })
      mount(Comp)

      expect(warn.mock.calls.flat().join(' ')).not.toContain('already exists')
      warn.mockRestore()
    })

    test('withFile twice emits no duplicate-key warning', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { withFile } = await import('#cwa/composables/cwa-file-plugin')
      const { ref, computed } = await import('vue')

      const ctx = {
        iri: ref('/resource/1'),
        resource: computed(() => undefined),
        $cwa: {} as never,
      }

      const Comp = defineComponent({
        setup() {
          withFile({ imagineFilterName: 'thumbnail' })(ctx as never)
          withFile({ imagineFilterName: 'general' })(ctx as never)
          return () => h('div')
        },
      })
      mount(Comp)

      expect(warn.mock.calls.flat().join(' ')).not.toContain('already exists')
      warn.mockRestore()
    })
  })
})

// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { createApp, defineAsyncComponent, defineComponent, h, onMounted, onUnmounted, ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { consola } from 'consola'
import AddComponentUiChoices from './AddComponentUiChoices.vue'

const app: any = createApp({ render: () => null })
const globals: Record<string, any> = app._context.components

mockNuxtImport('useNuxtApp', () => () => ({ vueApp: app }))

enableAutoUnmount(afterEach)

function heroChunk(meta: Record<string, unknown>, render: () => unknown = () => h('div')) {
  const mounted = vi.fn()
  const unmounted = vi.fn()
  let load!: () => void
  const Hero = defineComponent({
    props: { iri: { type: String, required: true } },
    setup(_props, { expose }) {
      expose(meta)
      onMounted(mounted)
      onUnmounted(unmounted)
      return render
    },
  })
  const component = defineAsyncComponent(() => new Promise<typeof Hero>((resolve) => {
    load = () => resolve(Hero)
  }))
  return { component, mounted, unmounted, load: () => load() }
}

function mountChoices(component: unknown) {
  globals.CwaComponentHero = component
  const uiClassNames = ref<string[] | undefined>()
  const Host = defineComponent({
    setup() {
      return () => h(AddComponentUiChoices, {
        'name': 'Hero',
        'ui': [],
        'uiClassNames': uiClassNames.value,
        'onUpdate:uiClassNames': (value: string[] | undefined) => (uiClassNames.value = value),
      })
    },
  })
  const wrapper = mount(Host, { attachTo: document.body, global: { components: { CwaComponentHero: component as any } } })
  return { wrapper, uiClassNames }
}

async function settle() {
  await flushPromises()
  await new Promise(resolve => setTimeout(resolve, 30))
  await flushPromises()
}

describe('the add component detail reads styles from the component mounted detached (#461)', () => {
  afterEach(() => {
    delete globals.CwaComponentHero
    vi.restoreAllMocks()
  })

  test('reads the styles once the chunk loads, and unmounts the detached instance', async () => {
    const hero = heroChunk({ cwaResource: { styles: { classes: { Dark: 'bg-black' } } } })
    const { wrapper } = mountChoices(hero.component)
    await flushPromises()
    expect(wrapper.find('[data-testid="add-component-style"]').exists()).toBe(false)

    hero.load()
    await settle()

    expect(wrapper.find('[data-testid="add-component-style"]').exists()).toBe(true)
    expect(hero.mounted).toHaveBeenCalledTimes(1)
    expect(hero.unmounted).toHaveBeenCalledTimes(1)
  })

  test('closing the dialog before the chunk loads leaves no detached instance mounted', async () => {
    const hero = heroChunk({ cwaResource: { styles: { classes: { Dark: 'bg-black' } } } })
    const { wrapper } = mountChoices(hero.component)
    await flushPromises()

    wrapper.unmount()
    hero.load()
    await settle()

    expect(hero.unmounted).toHaveBeenCalledTimes(hero.mounted.mock.calls.length)
  })

  test('a component that cannot render with no data offers no styles, and the choices still render', async () => {
    vi.spyOn(consola, 'warn').mockImplementation(() => undefined)
    const hero = heroChunk({ cwaResource: { styles: { classes: { Dark: 'bg-black' } } } }, () => {
      throw new TypeError('Cannot read properties of undefined (reading \'data\')')
    })
    const { wrapper, uiClassNames } = mountChoices(hero.component)

    hero.load()
    await settle()

    expect(wrapper.find('[data-testid="add-component-style"]').exists()).toBe(false)
    expect(uiClassNames.value).toBeUndefined()
    expect(consola.warn).toHaveBeenCalledTimes(1)
    expect(hero.unmounted).toHaveBeenCalledTimes(1)
  })
})

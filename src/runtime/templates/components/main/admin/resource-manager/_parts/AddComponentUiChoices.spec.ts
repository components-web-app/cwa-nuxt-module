// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { defineComponent } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import AddComponentUiChoices from './AddComponentUiChoices.vue'

const config = vi.hoisted(() => ({
  resourcesConfig: {} as Record<string, any>,
  uiConfig: {} as Record<string, any>,
}))

vi.mock('#build/cwa-config', () => config)

enableAutoUnmount(afterEach)

function mountChoices(ui: string[], uiClassNames?: string[], allowance?: { ui?: (string | null)[], styles?: string[] }) {
  const mounted: string[] = []
  const globals = Object.fromEntries(['CwaComponentHero', ...ui].map(name => [name, defineComponent({
    setup() {
      mounted.push(name)
      return () => null
    },
  })]))
  const wrapper = mount(AddComponentUiChoices, {
    props: { name: 'Hero', ui, uiClassNames, ...(allowance ? { allowance } : {}) },
    global: { components: globals },
  })
  return { wrapper, mounted }
}

describe('the UI and Style choices of the add component detail (#461)', () => {
  afterEach(() => {
    config.resourcesConfig = {}
    config.uiConfig = {}
  })

  test('mounts no component to find out its UI names or styles: they come from the generated config (#453)', async () => {
    config.resourcesConfig = { Hero: { styles: { dark: { label: 'Dark', classes: 'bg-black' } } } }
    config.uiConfig = { CwaComponentHeroUiSplitImage: { name: 'Split image' } }
    const { wrapper, mounted } = mountChoices(['CwaComponentHeroUiSplitImage'])
    await wrapper.get('[data-testid="add-component-ui"] [data-testid="select-trigger"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(mounted).toEqual([])
    expect([...document.querySelectorAll('[data-testid="select-menu"] [role="option"]')].map(option => option.textContent?.trim())).toEqual(['Default', 'Split image'])
    expect(wrapper.find('[data-testid="add-component-style"]').exists()).toBe(true)
  })

  test('a UI without its own name is named from its file', async () => {
    const { wrapper } = mountChoices(['CwaComponentHeroUiSplitImage'])
    await wrapper.get('[data-testid="select-trigger"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect([...document.querySelectorAll('[data-testid="select-menu"] [role="option"]')].map(option => option.textContent?.trim())).toEqual(['Default', 'Split Image'])
  })

  test('styles that allow several are chosen with the multi-select', () => {
    config.resourcesConfig = { Hero: { allowMultiple: true, styles: { dark: { label: 'Dark', classes: 'bg-black' }, boxed: { label: 'Boxed', classes: 'p-4' } } } }
    const { wrapper } = mountChoices([])

    expect(wrapper.find('[data-testid="add-component-ui"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="add-component-style"] [data-testid="multi-input"]').exists()).toBe(true)
  })

  test('the stored keys the default data sets are chosen against the styles of the chosen UI, and sent as style:<key> (#453)', async () => {
    config.resourcesConfig = { Hero: { styles: { dark: { label: 'Dark', classes: 'bg-black' } } } }
    config.uiConfig = { CwaComponentHeroUiSplitImage: { allowMultiple: true, styles: { boxed: { label: 'Boxed', classes: 'p-4' }, dark: { label: 'Dark', classes: 'bg-neutral-900' } } } }
    const { wrapper } = mountChoices(['CwaComponentHeroUiSplitImage'], ['style:boxed', 'style:dark'])

    expect(wrapper.emitted('update:uiClassNames')!.at(-1)).toEqual([['style:dark']])

    await wrapper.setProps({ uiComponent: 'CwaComponentHeroUiSplitImage' })
    await flushPromises()
    expect(wrapper.emitted('update:uiClassNames')!.at(-1)).toEqual([['style:boxed', 'style:dark']])
  })

  test('a component with no UIs and no styles shows nothing', () => {
    const { wrapper } = mountChoices([])

    expect(wrapper.find('[data-testid="add-component-ui"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="add-component-style"]').exists()).toBe(false)
  })
})

describe('a group that restricts the UIs and styles it allows (#488)', () => {
  afterEach(() => {
    config.resourcesConfig = {}
    config.uiConfig = {}
  })

  async function optionsOf(wrapper: ReturnType<typeof mountChoices>['wrapper'], testId: string) {
    await wrapper.get(`[data-testid="${testId}"] [data-testid="select-trigger"]`).trigger('keydown', { key: 'Enter' })
    await flushPromises()
    return [...document.querySelectorAll('[data-testid="select-menu"] [role="option"]')].map(option => option.textContent?.trim())
  }

  test('offers only the UIs the group allows, with no Default when it does not allow the primary, and starts on the first allowed', async () => {
    config.uiConfig = { CwaComponentHeroUiSplitImage: { name: 'Split image' }, CwaComponentHeroUiWide: { name: 'Wide' } }
    const { wrapper } = mountChoices(['CwaComponentHeroUiSplitImage', 'CwaComponentHeroUiWide'], undefined, { ui: ['CwaComponentHeroUiWide'] })

    expect(wrapper.emitted('update:uiComponent')!.at(-1)).toEqual(['CwaComponentHeroUiWide'])
    expect(await optionsOf(wrapper, 'add-component-ui')).toEqual(['Wide'])
  })

  test('keeps Default when the group allows the primary', async () => {
    config.uiConfig = { CwaComponentHeroUiSplitImage: { name: 'Split image' }, CwaComponentHeroUiWide: { name: 'Wide' } }
    const { wrapper } = mountChoices(['CwaComponentHeroUiSplitImage', 'CwaComponentHeroUiWide'], undefined, { ui: [null, 'CwaComponentHeroUiWide'] })

    expect(wrapper.emitted('update:uiComponent')!.at(-1)).toEqual([null])
    expect(await optionsOf(wrapper, 'add-component-ui')).toEqual(['Default', 'Wide'])
  })

  test('offers only the styles the group allows, and drops a default style it does not', async () => {
    config.resourcesConfig = { Hero: { styles: { dark: { label: 'Dark', classes: 'bg-black' }, light: { label: 'Light', classes: 'bg-white' } } } }
    const { wrapper } = mountChoices([], ['style:light'], { styles: ['style:dark'] })

    expect(wrapper.emitted('update:uiClassNames')!.at(-1)).toEqual([[]])
    expect(await optionsOf(wrapper, 'add-component-style')).toEqual(['Default', 'Dark'])
  })
})

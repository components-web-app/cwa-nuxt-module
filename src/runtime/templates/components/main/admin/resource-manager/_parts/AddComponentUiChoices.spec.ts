// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import AddComponentUiChoices from './AddComponentUiChoices.vue'

const { resolvedMeta, resolved } = vi.hoisted(() => ({
  resolvedMeta: {} as Record<string, unknown>,
  resolved: { components: [] as string[], props: undefined as unknown },
}))

vi.mock('#cwa/templates/components/core/useDataResolver', () => ({
  useDataResolver: (meta: Ref<unknown[]>, ops: { components: Ref<string[]>, props: Ref<unknown> }) => {
    resolved.components = ops.components.value
    resolved.props = ops.props.value
    meta.value = ops.components.value.map(name => resolvedMeta[name] ?? null)
  },
}))

enableAutoUnmount(afterEach)

function mountChoices(ui: string[], globals: string[]) {
  return mount(AddComponentUiChoices, {
    props: { name: 'Hero', ui },
    global: { components: Object.fromEntries(globals.map(name => [name, { template: '<div />' }])) },
  })
}

describe('the UI and Style choices of the add component detail (#461)', () => {
  afterEach(() => {
    for (const name of Object.keys(resolvedMeta)) {
      delete resolvedMeta[name]
    }
  })

  test('resolves only the registered components, mounted for the new resource', () => {
    mountChoices(['CwaComponentHeroUiSplitImage', 'CwaComponentHeroUiMissing'], ['CwaComponentHero', 'CwaComponentHeroUiSplitImage'])

    expect(resolved.components).toEqual(['CwaComponentHero', 'CwaComponentHeroUiSplitImage'])
    expect(resolved.props).toEqual({ iri: '__new__' })
  })

  test('a UI without its own name is named from its file', async () => {
    const wrapper = mountChoices(['CwaComponentHeroUiSplitImage'], ['CwaComponentHero', 'CwaComponentHeroUiSplitImage'])
    await wrapper.get('[data-testid="select-trigger"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect([...document.querySelectorAll('[data-testid="select-menu"] [role="option"]')].map(option => option.textContent?.trim())).toEqual(['Default', 'Split Image'])
  })

  test('styles that allow several are chosen with the multi-select', () => {
    resolvedMeta.CwaComponentHero = { cwaResource: { styles: { multiple: true, classes: { Dark: 'bg-black', Boxed: 'p-4' } } } }
    const wrapper = mountChoices([], ['CwaComponentHero'])

    expect(wrapper.find('[data-testid="add-component-ui"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="add-component-style"] [data-testid="multi-input"]').exists()).toBe(true)
  })

  test('a component with no UIs and no styles shows nothing', () => {
    const wrapper = mountChoices([], ['CwaComponentHero'])

    expect(wrapper.find('[data-testid="add-component-ui"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="add-component-style"]').exists()).toBe(false)
  })
})

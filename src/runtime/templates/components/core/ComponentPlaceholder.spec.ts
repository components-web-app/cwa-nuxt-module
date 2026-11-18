// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import ComponentPlaceholder from './ComponentPlaceholder.vue'

const emit = vi.hoisted(() => vi.fn())
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => ({ admin: { eventBus: { emit } } }) }))

enableAutoUnmount(afterEach)

describe('ComponentPlaceholder (#461)', () => {
  test('an empty position is named by its page data property, or as an empty position, and shows no text', () => {
    const named = mount(ComponentPlaceholder, { props: { iri: '/_/component_positions/1', name: 'heroImage' } })
    const placeholder = named.get('[data-testid="edit-placeholder"]')
    expect(placeholder.get(`[id="${placeholder.attributes('aria-labelledby')}"]`).text()).toBe('heroImage')
    expect(placeholder.get(`[id="${placeholder.attributes('aria-labelledby')}"]`).classes()).toContain('cwa:sr-only')

    const unnamed = mount(ComponentPlaceholder, { props: { iri: '/_/component_positions/2' } }).get('[data-testid="edit-placeholder"]')
    expect(unnamed.get(`[id="${unnamed.attributes('aria-labelledby')}"]`).text()).toBe('Empty position')
  })

  test('says why it is empty in its description, with no info button', () => {
    const named = mount(ComponentPlaceholder, { props: { iri: '/_/component_positions/1', name: 'heroImage' } }).get('[data-testid="edit-placeholder"]')
    expect(named.find('[data-testid="field-info"]').exists()).toBe(false)
    expect(named.get(`[id="${named.attributes('aria-describedby')}"]`).text()).toBe('This page data has no heroImage component yet, so visitors see nothing here.')

    const unnamed = mount(ComponentPlaceholder, { props: { iri: '/_/component_positions/2' } }).get('[data-testid="edit-placeholder"]')
    expect(unnamed.get(`[id="${unnamed.attributes('aria-describedby')}"]`).text()).toBe('No component is placed here yet, so visitors see nothing here.')
  })

  test('tells the admin it has mounted, so the selection outline can be drawn around it', () => {
    mount(ComponentPlaceholder, { props: { iri: '/_/component_positions/1' } })

    expect(emit).toHaveBeenCalledWith('componentMounted', '/_/component_positions/1_placeholder')
  })
})

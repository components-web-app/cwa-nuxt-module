// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import ComponentPlaceholder from './ComponentPlaceholder.vue'

const emit = vi.hoisted(() => vi.fn())
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => ({ admin: { eventBus: { emit } } }) }))

enableAutoUnmount(afterEach)

describe('ComponentPlaceholder (#461)', () => {
  test('an empty position shows the kit placeholder named by its page data property, or as an empty position', () => {
    const named = mount(ComponentPlaceholder, { props: { iri: '/_/component_positions/1', name: 'heroImage' } })
    expect(named.get('[data-testid="edit-placeholder"]').text()).toContain('heroImage')

    const unnamed = mount(ComponentPlaceholder, { props: { iri: '/_/component_positions/2' } })
    expect(unnamed.get('[data-testid="edit-placeholder"]').text()).toContain('Empty position')
  })

  test('says why it is empty only behind its info button, described by it, never inline', () => {
    const named = mount(ComponentPlaceholder, { props: { iri: '/_/component_positions/1', name: 'heroImage' }, attachTo: document.body })
    const info = named.get('[data-testid="field-info"]')
    const description = document.getElementById(info.attributes('aria-describedby')!)!

    expect(description.textContent).toBe('This page data has no heroImage component yet, so visitors see nothing here.')
    expect(description.classList).toContain('cwa:sr-only')
    named.unmount()

    const unnamed = mount(ComponentPlaceholder, { props: { iri: '/_/component_positions/2' }, attachTo: document.body })
    expect(document.getElementById(unnamed.get('[data-testid="field-info"]').attributes('aria-describedby')!)!.textContent).toBe('No component is placed here yet, so visitors see nothing here.')
  })

  test('tells the admin it has mounted, so the selection outline can be drawn around it', () => {
    mount(ComponentPlaceholder, { props: { iri: '/_/component_positions/1' } })

    expect(emit).toHaveBeenCalledWith('componentMounted', '/_/component_positions/1_placeholder')
  })
})

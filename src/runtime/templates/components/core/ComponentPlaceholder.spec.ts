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

  test('tells the admin it has mounted, so the selection outline can be drawn around it', () => {
    mount(ComponentPlaceholder, { props: { iri: '/_/component_positions/1' } })

    expect(emit).toHaveBeenCalledWith('componentMounted', '/_/component_positions/1_placeholder')
  })
})

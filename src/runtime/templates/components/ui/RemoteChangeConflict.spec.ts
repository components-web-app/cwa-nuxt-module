// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { RemoteFieldChange } from '#cwa/resources/model-editors'
import RemoteChangeConflict from './RemoteChangeConflict.vue'

function change(name: string): RemoteFieldChange {
  return { name, value: 'theirs', accept: vi.fn(), keep: vi.fn(() => Promise.resolve()) }
}

describe('CwaUiRemoteChangeConflict, for an app\'s own editor such as TipTap (#429)', () => {
  test('names who changed the field by the name the change gives them', () => {
    expect(mount(RemoteChangeConflict, { props: { change: change('You (other window)') } }).text()).toContain('You (other window) changed this')
  })

  test('Use theirs accepts the change and Keep mine keeps the editor\'s own', async () => {
    const held = change('Sam')
    const wrapper = mount(RemoteChangeConflict, { props: { change: held } })

    await wrapper.get('[data-testid="remote-change-accept"]').trigger('click')
    expect(held.accept).toHaveBeenCalledOnce()
    expect(held.keep).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="remote-change-keep"]').trigger('click')
    expect(held.keep).toHaveBeenCalledOnce()
  })
})

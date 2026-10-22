// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { RemoteFieldChange } from '#cwa/resources/model-editors'
import RemoteChangeConflict from './RemoteChangeConflict.vue'

function change(user?: RemoteFieldChange['user']): RemoteFieldChange {
  return { user, value: 'theirs', accept: vi.fn(), keep: vi.fn(() => Promise.resolve()) }
}

describe('CwaUiRemoteChangeConflict, for an app\'s own editor such as TipTap (#429)', () => {
  test('names who changed the field, or "Someone" when the change carries no name', () => {
    expect(mount(RemoteChangeConflict, { props: { change: change({ id: '/users/sam', name: 'Sam', isSelf: false }) } }).text()).toContain('Sam changed this')
    expect(mount(RemoteChangeConflict, { props: { change: change() } }).text()).toContain('Someone changed this')
  })

  test('says "You (other window)" for a change from this admin\'s other window', () => {
    const wrapper = mount(RemoteChangeConflict, { props: { change: change({ id: '/users/me', name: 'Me', isSelf: true }) } })

    expect(wrapper.text()).toContain('You (other window) changed this')
  })

  test('Use theirs accepts the change and Keep mine keeps the editor\'s own', async () => {
    const held = change({ id: '/users/sam', name: 'Sam', isSelf: false })
    const wrapper = mount(RemoteChangeConflict, { props: { change: held } })

    await wrapper.get('[data-testid="remote-change-accept"]').trigger('click')
    expect(held.accept).toHaveBeenCalledOnce()
    expect(held.keep).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="remote-change-keep"]').trigger('click')
    expect(held.keep).toHaveBeenCalledOnce()
  })
})

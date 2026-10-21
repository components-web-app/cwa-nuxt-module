// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, h, nextTick, ref } from 'vue'
import type { FocusedPeer } from '#cwa/admin/presence'
import FieldPresence from './FieldPresence.vue'

const SAM = { user: { id: '/users/sam', name: 'Sam' }, colour: '#c084fc' }
const ALEX = { user: { id: '/users/alex', name: 'Alex' }, colour: '#14b8a6' }
const ANON = { user: { id: '/users/anon' }, colour: '#4ade80' }

afterEach(() => {
  vi.useRealTimers()
})

describe('CwaUiFieldPresence (#429)', () => {
  test('wraps the field it is given in a hover group, and shows no one while no one is in it', () => {
    const wrapper = mount(FieldPresence, { props: { focusedBy: [] }, attrs: { class: 'cwa:flex' }, slots: { default: () => h('input') } })

    expect(wrapper.find('input').exists()).toBe(true)
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:relative', 'cwa:group/field', 'cwa:flex']))
    expect(wrapper.find('[data-testid="field-presence"]').exists()).toBe(false)
  })

  test('outlines the field in the first person\'s colour, without taking clicks, and names everyone in it', () => {
    const wrapper = mount(FieldPresence, { props: { focusedBy: [SAM, ALEX, ANON] } })

    const outline = wrapper.get('[data-testid="field-presence"]')
    expect(outline.attributes('style')).toContain('outline-color: #c084fc')
    expect(outline.classes()).toContain('cwa:pointer-events-none')
    const flag = wrapper.get('[data-testid="field-presence-flag"]')
    expect(flag.text()).toBe('Sam, Alex, Someone')
    expect(flag.attributes('style')).toContain('background-color: #c084fc')
  })

  test('reads who is in the field from a resource model', async () => {
    const peers = ref<FocusedPeer[]>([])
    const wrapper = mount(FieldPresence, { props: { model: { model: { value: '' }, remoteChange: { value: undefined }, focusedBy: computed(() => peers.value) } } })
    expect(wrapper.find('[data-testid="field-presence"]').exists()).toBe(false)

    peers.value = [ALEX]
    await nextTick()

    expect(wrapper.get('[data-testid="field-presence-flag"]').text()).toBe('Alex')
  })

  test('the name fades after 3 seconds, shows again on hover over the field, and comes back when someone else is in it', async () => {
    vi.useFakeTimers()
    const wrapper = mount(FieldPresence, { props: { focusedBy: [SAM] } })
    const flag = () => wrapper.get('[data-testid="field-presence-flag"]')
    expect(flag().attributes('data-faded')).toBeUndefined()

    vi.advanceTimersByTime(3000)
    await nextTick()
    expect(flag().attributes('data-faded')).toBe('true')
    expect(flag().classes()).toContain('cwa:group-hover/field:opacity-100')

    await wrapper.setProps({ focusedBy: [{ ...SAM }] })
    expect(flag().attributes('data-faded')).toBe('true')

    await wrapper.setProps({ focusedBy: [ALEX] })
    expect(flag().attributes('data-faded')).toBeUndefined()
  })
})

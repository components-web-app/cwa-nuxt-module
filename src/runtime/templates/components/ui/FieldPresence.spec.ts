// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, h, nextTick, ref } from 'vue'
import type { FocusedPeer } from '#cwa/admin/presence'
import FieldPresence from './FieldPresence.vue'

const SAM = { user: { id: '/users/sam', name: 'Sam' }, name: 'Sam', colour: '#c084fc', isSelf: false, clientIds: ['tab-sam'] }
const ALEX = { user: { id: '/users/alex', name: 'Alex' }, name: 'Alex', colour: '#14b8a6', isSelf: false, clientIds: ['tab-alex'] }
const ANON = { user: { id: '/users/anon' }, name: 'Someone', colour: '#4ade80', isSelf: false, clientIds: ['tab-anon'] }
const ME = { user: { id: '/users/me', name: 'Me' }, name: 'You (other window)', colour: '#a8a29e', isSelf: true, clientIds: ['tab-me'] }

function fieldWith(peers: FocusedPeer[] | { value: FocusedPeer[] }) {
  const focused = Array.isArray(peers) ? ref(peers) : peers
  return { model: { value: '' }, remoteChange: { value: undefined }, focusedBy: computed(() => focused.value) }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('CwaUiFieldPresence (#429)', () => {
  test('wraps the field it is given in a hover group, and shows no one while no one is in it', () => {
    const wrapper = mount(FieldPresence, { props: { model: fieldWith([]) }, attrs: { class: 'cwa:flex' }, slots: { default: () => h('input') } })

    expect(wrapper.find('input').exists()).toBe(true)
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:relative', 'cwa:group/field', 'cwa:flex']))
    expect(wrapper.find('[data-testid="field-presence"]').exists()).toBe(false)
  })

  test('outlines the field in the first person\'s colour, without taking clicks, and names everyone in it', () => {
    const wrapper = mount(FieldPresence, { props: { model: fieldWith([SAM, ALEX, ANON]) } })

    const outline = wrapper.get('[data-testid="field-presence"]')
    expect(outline.attributes('style')).toContain('outline-color: #c084fc')
    expect(outline.classes()).toContain('cwa:pointer-events-none')
    const flag = wrapper.get('[data-testid="field-presence-flag"]')
    expect(flag.text()).toBe('Sam, Alex, Someone')
    expect(flag.attributes('style')).toContain('background-color: #c084fc')
  })

  test('each person is shown by the name presence gives them, so this admin\'s other window is never shown by their own name', () => {
    const wrapper = mount(FieldPresence, { props: { model: fieldWith([ME, SAM]) } })

    expect(wrapper.get('[data-testid="field-presence-flag"]').text()).toBe('You (other window), Sam')
  })

  test('follows who is in the field as the resource model changes, and shows no one without a model', async () => {
    expect(mount(FieldPresence).find('[data-testid="field-presence"]').exists()).toBe(false)
    const peers = ref<FocusedPeer[]>([])
    const wrapper = mount(FieldPresence, { props: { model: fieldWith(peers) } })
    expect(wrapper.find('[data-testid="field-presence"]').exists()).toBe(false)

    peers.value = [ALEX]
    await nextTick()

    expect(wrapper.get('[data-testid="field-presence-flag"]').text()).toBe('Alex')
  })

  test('the name fades after 3 seconds, shows again on hover over the field, and comes back when someone else is in it', async () => {
    vi.useFakeTimers()
    const peers = ref<FocusedPeer[]>([SAM])
    const wrapper = mount(FieldPresence, { props: { model: fieldWith(peers) } })
    const flag = () => wrapper.get('[data-testid="field-presence-flag"]')
    expect(flag().attributes('data-faded')).toBeUndefined()

    vi.advanceTimersByTime(3000)
    await nextTick()
    expect(flag().attributes('data-faded')).toBe('true')
    expect(flag().classes()).toContain('cwa:group-hover/field:opacity-100')

    peers.value = [{ ...SAM }]
    await nextTick()
    expect(flag().attributes('data-faded')).toBe('true')

    peers.value = [ALEX]
    await nextTick()
    expect(flag().attributes('data-faded')).toBeUndefined()
  })
})

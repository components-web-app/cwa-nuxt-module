// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import FieldPresence from './FieldPresence.vue'

const SAM = { user: { id: '/users/sam', name: 'Sam' }, colour: '#c084fc' }
const ALEX = { user: { id: '/users/alex', name: 'Alex' }, colour: '#14b8a6' }
const ANON = { user: { id: '/users/anon' }, colour: '#f472b6' }

afterEach(() => {
  vi.useRealTimers()
})

describe('FieldPresence (#429)', () => {
  test('outlines the field in the first person\'s colour, without taking clicks, and names everyone in it', () => {
    const wrapper = mount(FieldPresence, { props: { peers: [SAM, ALEX, ANON] } })

    const outline = wrapper.get('[data-testid="field-presence"]')
    expect(outline.attributes('style')).toContain('outline-color: #c084fc')
    expect(outline.classes()).toContain('cwa:pointer-events-none')
    const flag = wrapper.get('[data-testid="field-presence-flag"]')
    expect(flag.text()).toBe('Sam, Alex, Someone')
    expect(flag.attributes('style')).toContain('background-color: #c084fc')
  })

  test('the name fades after 3 seconds, shows again on hover over the field, and comes back when someone else is in it', async () => {
    vi.useFakeTimers()
    const wrapper = mount(FieldPresence, { props: { peers: [SAM] } })
    const flag = () => wrapper.get('[data-testid="field-presence-flag"]')
    expect(flag().attributes('data-faded')).toBeUndefined()

    vi.advanceTimersByTime(3000)
    await nextTick()
    expect(flag().attributes('data-faded')).toBe('true')
    expect(flag().classes()).toContain('cwa:group-hover/field:opacity-100')

    await wrapper.setProps({ peers: [{ ...SAM }] })
    expect(flag().attributes('data-faded')).toBe('true')

    await wrapper.setProps({ peers: [ALEX] })
    expect(flag().attributes('data-faded')).toBeUndefined()
  })
})

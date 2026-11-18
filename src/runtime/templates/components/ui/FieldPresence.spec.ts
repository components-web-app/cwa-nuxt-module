// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h, nextTick, provide, ref } from 'vue'
import type { FocusedPeer } from '#cwa/admin/presence'
import { presenceLayerKey } from '../core/ui/field-keys'
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

  test('rings the field inside its box with a 2px ring in the first person\'s colour, without taking clicks, and names everyone in it (#476 review 9)', () => {
    const wrapper = mount(FieldPresence, { props: { model: fieldWith([SAM, ALEX, ANON]) } })

    const outline = wrapper.get('[data-testid="field-presence"]')
    expect(outline.attributes('style')).toContain('box-shadow: inset 0 0 0 2px #c084fc')
    expect(outline.attributes('style')).not.toContain('outline')
    expect(outline.classes()).toEqual(expect.arrayContaining(['cwa:pointer-events-none', 'cwa:absolute', 'cwa:inset-0']))
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
    expect(flag().classes()).toContain('cwa:opacity-0')
    await wrapper.trigger('pointerenter')
    expect(flag().classes()).toContain('cwa:opacity-100')
    await wrapper.trigger('pointerleave')
    expect(flag().classes()).toContain('cwa:opacity-0')

    peers.value = [{ ...SAM }]
    await nextTick()
    expect(flag().attributes('data-faded')).toBe('true')

    peers.value = [ALEX]
    await nextTick()
    expect(flag().attributes('data-faded')).toBeUndefined()
  })

  test('focusing a field another editor holds replaces their ring with your own focus ring, and keeps their flag up saying they are editing it too until you leave (#476 review 9)', async () => {
    vi.useFakeTimers()
    const wrapper = mount(FieldPresence, { props: { model: fieldWith([SAM]) }, attrs: { onFocusin: () => {} }, slots: { default: () => [h('input', { id: 'a' }), h('input', { id: 'b' })] }, attachTo: document.body })
    const outline = () => wrapper.get('[data-testid="field-presence"]')
    const flag = () => wrapper.get('[data-testid="field-presence-flag"]')

    await wrapper.get('#a').trigger('focusin')
    expect(outline().attributes('style') ?? '').not.toContain('box-shadow')
    expect(flag().text()).toBe('Sam is editing this too')

    vi.advanceTimersByTime(5000)
    await wrapper.get('#a').trigger('focusout', { relatedTarget: wrapper.get('#b').element })
    await nextTick()
    expect(flag().attributes('data-faded')).toBeUndefined()
    expect(flag().text()).toBe('Sam is editing this too')

    await wrapper.get('#b').trigger('focusout', { relatedTarget: document.body })
    expect(outline().attributes('style')).toContain('box-shadow: inset 0 0 0 2px #c084fc')
    expect(flag().text()).toBe('Sam')
    expect(flag().attributes('data-faded')).toBe('true')
    wrapper.unmount()
  })

  test('says "are" when more than one editor, or your other window, holds the field you focus (#476 review 9)', async () => {
    const many = mount(FieldPresence, { props: { model: fieldWith([SAM, ALEX]) }, attrs: { onFocusin: () => {} }, slots: { default: () => h('input') } })
    await many.get('input').trigger('focusin')
    expect(many.get('[data-testid="field-presence-flag"]').text()).toBe('Sam, Alex are editing this too')

    const self = mount(FieldPresence, { props: { model: fieldWith([ME]) }, attrs: { onFocusin: () => {} }, slots: { default: () => h('input') } })
    await self.get('input').trigger('focusin')
    expect(self.get('[data-testid="field-presence-flag"]').text()).toBe('You (other window) are editing this too')
  })

  test('focus in a field that reports none of yours, such as a disabled one, leaves the other editor\'s ring and flag as they are (#476 review 9)', async () => {
    const wrapper = mount(FieldPresence, { props: { model: fieldWith([SAM]) }, slots: { default: () => h('input') } })
    await wrapper.get('input').trigger('focusin')

    expect(wrapper.get('[data-testid="field-presence"]').attributes('style')).toContain('box-shadow')
    expect(wrapper.get('[data-testid="field-presence-flag"]').text()).toBe('Sam')
  })

  describe('inside a surface that gives a presence layer (#476 review 1)', () => {
    function rect(top: number, left: number, width: number, height: number) {
      return { top, left, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect
    }

    function mountInLayer(align: 'start' | 'end', peers = ref<FocusedPeer[]>([SAM])) {
      const layerEl = ref<HTMLElement | null>(null)
      const Host = defineComponent({
        setup() {
          provide(presenceLayerKey, { el: layerEl, align })
          return () => h('div', { 'data-testid': 'scroller', 'style': 'overflow: hidden' }, [
            h(FieldPresence, { model: fieldWith(peers) }, () => h('input')),
            h('div', { 'ref': layerEl, 'data-testid': 'layer' }),
          ])
        },
      })
      const wrapper = mount(Host, { attachTo: document.body })
      const layer = wrapper.get('[data-testid="layer"]').element as HTMLElement
      const field = wrapper.get('.cwa\\:group\\/field').element as HTMLElement
      layer.getBoundingClientRect = () => rect(100, 20, 600, 60)
      field.getBoundingClientRect = () => rect(112, 80, 144, 36)
      return { wrapper, layer, field, peers }
    }

    test('moves the flag out of the field into the layer, on the field\'s top-left edge, so the field\'s scrolling row never clips it', async () => {
      const { wrapper, layer, field } = mountInLayer('start')
      await nextTick()
      await vi.waitFor(() => expect(layer.querySelector('[data-testid="field-presence-flag"]')).not.toBeNull())
      const flag = layer.querySelector<HTMLElement>('[data-testid="field-presence-flag"]')!

      expect(field.querySelector('[data-testid="field-presence-flag"]')).toBeNull()
      expect(flag.textContent).toBe('Sam')
      expect(flag.style.top).toBe('3px')
      expect(flag.style.left).toBe('60px')
      expect(wrapper.get('[data-testid="field-presence"]').attributes('style')).toContain('inset 0 0 0 2px')
    })

    test('follows the field when its row scrolls', async () => {
      const { layer, field } = mountInLayer('start')
      await vi.waitFor(() => expect(layer.querySelector('[data-testid="field-presence-flag"]')).not.toBeNull())

      field.getBoundingClientRect = () => rect(112, 30, 144, 36)
      document.querySelector('[data-testid="scroller"]')!.dispatchEvent(new Event('scroll'))

      await vi.waitFor(() => expect(layer.querySelector<HTMLElement>('[data-testid="field-presence-flag"]')!.style.left).toBe('10px'))
    })

    test('sits on the field\'s top-right edge in a dialog, clear of the label above the field', async () => {
      const { layer } = mountInLayer('end')
      await vi.waitFor(() => expect(layer.querySelector('[data-testid="field-presence-flag"]')).not.toBeNull())
      const flag = layer.querySelector<HTMLElement>('[data-testid="field-presence-flag"]')!

      expect(flag.style.right).toBe('396px')
      expect(flag.style.left).toBe('')
    })

    test('leaves the layer when no one is in the field', async () => {
      const { layer, peers } = mountInLayer('start')
      await vi.waitFor(() => expect(layer.querySelector('[data-testid="field-presence-flag"]')).not.toBeNull())

      peers.value = []
      await nextTick()

      expect(layer.querySelector('[data-testid="field-presence-flag"]')).toBeNull()
    })
  })
})

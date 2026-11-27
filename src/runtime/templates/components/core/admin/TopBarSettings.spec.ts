// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../../test/utils/axe'
import TopBarSettings from './TopBarSettings.vue'

const { areas } = vi.hoisted(() => ({
  areas: [
    { segment: 'shop', label: 'Shop', icon: '<svg id="shop-icon" />', topBar: true, pages: [{ path: '', label: 'Orders', role: 'ROLE_ADMIN' }] },
    { segment: 'reports', label: 'Reports', icon: '<svg id="reports-icon" />', pages: [{ path: '', label: 'Sales', role: 'ROLE_ADMIN' }] },
  ],
}))

vi.mock('#build/cwa-extension-areas', () => ({ extensionAreas: areas }))

enableAutoUnmount(afterEach)

function setup(saved = '') {
  const value = ref(saved)
  const wrapper = mount(defineComponent({
    setup: () => () => h(TopBarSettings, { 'modelValue': value.value, 'onUpdate:modelValue': (next: string) => { value.value = next } }),
  }), { attachTo: document.body })
  return { wrapper, value }
}

type Wrapper = ReturnType<typeof setup>['wrapper']

const rows = (wrapper: Wrapper) => wrapper.findAll('[data-testid="top-bar-choice"]').map(row => [row.get('label').text(), row.get('[role="switch"]').attributes('aria-checked')])
const row = (wrapper: Wrapper, label: string) => wrapper.findAll('[data-testid="top-bar-choice"]').find(found => found.get('label').text() === label)!

describe('TopBarSettings', () => {
  test('with nothing saved lists the default items as shown, in order, then the rest as hidden', () => {
    const { wrapper } = setup()
    expect(rows(wrapper)).toEqual([
      ['Layouts', 'true'],
      ['Pages', 'true'],
      ['Data', 'true'],
      ['Routes', 'true'],
      ['Users', 'true'],
      ['Shop', 'true'],
      ['Reports', 'false'],
    ])
    expect(row(wrapper, 'Shop').find('#shop-icon').exists()).toBe(true)
  })

  test('lists a saved setting\'s items first, in its order', () => {
    const { wrapper } = setup('ext:reports,pages')
    expect(rows(wrapper).slice(0, 3)).toEqual([['Reports', 'true'], ['Pages', 'true'], ['Layouts', 'false']])
  })

  test('switching an item off saves every other shown item, in order, so the list no longer follows the default', async () => {
    const { wrapper, value } = setup()
    await row(wrapper, 'Data').get('[role="switch"]').trigger('click')
    expect(value.value).toBe('layouts,pages,routes,users,ext:shop')
  })

  test('switching an item on adds it after the shown items', async () => {
    const { wrapper, value } = setup('pages')
    await row(wrapper, 'Reports').get('[role="switch"]').trigger('click')
    expect(value.value).toBe('pages,ext:reports')
  })

  test('switching off the last shown item saves a list naming nothing, never the empty default', async () => {
    const { wrapper, value } = setup('pages')
    await row(wrapper, 'Pages').get('[role="switch"]').trigger('click')
    expect(value.value).toBe('none')
  })

  test('moves a shown item up or down, and only shown items can move, within the shown ones', async () => {
    const { wrapper, value } = setup('pages,layouts,ext:shop')
    expect(row(wrapper, 'Pages').get('button[aria-label="Move Pages up"]').attributes('aria-disabled')).toBe('true')
    expect(row(wrapper, 'Shop').get('button[aria-label="Move Shop down"]').attributes('aria-disabled')).toBe('true')
    expect(row(wrapper, 'Data').find('button[aria-label="Move Data up"]').exists()).toBe(false)

    await row(wrapper, 'Layouts').get('button[aria-label="Move Layouts up"]').trigger('click')
    expect(value.value).toBe('layouts,pages,ext:shop')
    await flushPromises()
    await row(wrapper, 'Pages').get('button[aria-label="Move Pages down"]').trigger('click')
    expect(value.value).toBe('layouts,ext:shop,pages')
  })

  test('Reset to default clears the setting, and is unavailable while nothing is saved', async () => {
    const { wrapper, value } = setup('pages')
    await wrapper.get('[data-testid="top-bar-reset"]').trigger('click')
    expect(value.value).toBe('')
    await flushPromises()
    expect(wrapper.get('[data-testid="top-bar-reset"]').attributes('aria-disabled')).toBe('true')
  })

  test('has no accessibility violations', async () => {
    setup('pages')
    expect(await axe(document.body)).toHaveNoViolations()
  })
})

// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { axe } from '../../../../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../../../../test/utils/focus-ring'
import ManagerTabs from './ManagerTabs.vue'

enableAutoUnmount(afterEach)

const tabs = [
  { name: 'Info', order: 2, fields: [] },
  { name: 'Content', order: 1, fields: ['title', 'body'] },
  { name: 'Ui', order: 3, fields: ['uiClassNames'] },
]

const state = (status: 'error' | 'conflict' | 'saved') => ({ status, waiting: false, slow: false })

describe('ManagerTabs (#459)', () => {
  test('tabs are a named tablist in their order, each a tab controlling the panel, and a tab holding a field to fix carries a badge named in its label', () => {
    const wrapper = mount(ManagerTabs, { props: { tabs, idPrefix: 'bar', label: 'Rich text settings', fieldStates: { title: state('error'), body: state('conflict'), uiClassNames: state('saved') } } })
    const buttons = wrapper.findAll('button')

    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('Rich text settings')
    expect(buttons.map(button => button.text())).toEqual(['Content', 'Info', 'Ui'])
    expect(buttons.map(button => button.attributes('role'))).toEqual(['tab', 'tab', 'tab'])
    expect(buttons.map(button => button.attributes('aria-selected'))).toEqual(['true', 'false', 'false'])
    expect(buttons.map(button => button.attributes('tabindex'))).toEqual(['0', '-1', '-1'])
    expect(buttons.map(button => button.attributes('id'))).toEqual(['bar-tab-1', 'bar-tab-0', 'bar-tab-2'])
    expect(buttons.map(button => button.attributes('aria-controls'))).toEqual(['bar-panel', 'bar-panel', 'bar-panel'])
    expect(buttons[0]!.attributes('aria-pressed')).toBeUndefined()
    expect(buttons.map(button => button.attributes('aria-keyshortcuts'))).toEqual(['F6', undefined, undefined])
    expect(buttons[0]!.attributes('data-badge')).toBe('conflict')
    expect(buttons[0]!.attributes('aria-label')).toBe('Content: 1 conflict to resolve, 1 not saved')
    expect(buttons[2]!.attributes('data-badge')).toBeUndefined()
    expect(buttons[2]!.attributes('aria-label')).toBeUndefined()
  })

  test('selectOriginal selects a tab by its index before ordering, which is how the bar shows a field', async () => {
    const wrapper = mount(ManagerTabs, { props: { tabs, idPrefix: 'bar', label: 'Settings' } })

    const tabsVm = wrapper.vm as unknown as { selectOriginal: (index: number) => void }
    tabsVm.selectOriginal(2)
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('button')[2]!.attributes('aria-selected')).toBe('true')
    expect(wrapper.emitted('click')!.at(-1)).toEqual([2])
  })

  test('the arrow keys, Home and End select the next, previous, first and last tab, wrapping, and move focus to it', async () => {
    const wrapper = mount(ManagerTabs, { props: { tabs, idPrefix: 'bar', label: 'Settings' }, attachTo: document.body })
    const buttons = () => wrapper.findAll('button')
    const press = async (key: string) => {
      await (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
    }
    buttons()[0]!.element.focus()

    const arrow = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    document.activeElement!.dispatchEvent(arrow)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(arrow.defaultPrevented).toBe(true)
    expect(buttons()[1]!.attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(buttons()[1]!.element)
    expect(wrapper.emitted('click')!.at(-1)).toEqual([0])

    await press('End')
    expect(document.activeElement).toBe(buttons()[2]!.element)
    await press('ArrowRight')
    expect(document.activeElement).toBe(buttons()[0]!.element)
    await press('ArrowLeft')
    expect(document.activeElement).toBe(buttons()[2]!.element)
    await press('Home')
    expect(document.activeElement).toBe(buttons()[0]!.element)
    expect(buttons().map(button => button.attributes('tabindex'))).toEqual(['0', '-1', '-1'])

    const ctrl = new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true, cancelable: true })
    document.activeElement!.dispatchEvent(ctrl)
    await wrapper.vm.$nextTick()
    expect(ctrl.defaultPrevented).toBe(false)
    expect(buttons()[0]!.attributes('aria-selected')).toBe('true')
  })

  test('has no axe violations', async () => {
    const panel = document.createElement('div')
    panel.id = 'bar-panel'
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', 'bar-tab-1')
    panel.textContent = 'Content'
    const wrapper = mount(ManagerTabs, { props: { tabs, idPrefix: 'bar', label: 'Settings', fieldStates: { title: state('error') } }, attachTo: document.body })
    document.body.append(panel)

    expect(await axe(document.body)).toHaveNoViolations()
    wrapper.unmount()
    panel.remove()
  })

  test('each tab draws its focus ring when focused from the keyboard', () => {
    const wrapper = mount(ManagerTabs, { props: { tabs, idPrefix: 'bar', label: 'Settings' } })

    expect(wrapper.findAll('button').map(button => drawsFocusRing(button.classes()))).toEqual([true, true, true])
  })
})

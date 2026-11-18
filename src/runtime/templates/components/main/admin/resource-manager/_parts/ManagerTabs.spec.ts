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
  test('tabs are pressed buttons in their order, and a tab holding a field to fix carries a badge named in its label', () => {
    const wrapper = mount(ManagerTabs, { props: { tabs, fieldStates: { title: state('error'), body: state('conflict'), uiClassNames: state('saved') } } })
    const buttons = wrapper.findAll('button')

    expect(buttons.map(button => button.text())).toEqual(['Content', 'Info', 'Ui'])
    expect(buttons[0]!.attributes('aria-pressed')).toBe('true')
    expect(buttons[0]!.attributes('data-badge')).toBe('conflict')
    expect(buttons[0]!.attributes('aria-label')).toBe('Content: 1 conflict to resolve, 1 not saved')
    expect(buttons[2]!.attributes('data-badge')).toBeUndefined()
    expect(buttons[2]!.attributes('aria-label')).toBeUndefined()
  })

  test('selectOriginal selects a tab by its index before ordering, which is how the bar shows a field', async () => {
    const wrapper = mount(ManagerTabs, { props: { tabs } })

    const tabsVm = wrapper.vm as unknown as { selectOriginal: (index: number) => void }
    tabsVm.selectOriginal(2)
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('button')[2]!.attributes('aria-pressed')).toBe('true')
    expect(wrapper.emitted('click')!.at(-1)).toEqual([2])
  })

  test('has no axe violations', async () => {
    const wrapper = mount(ManagerTabs, { props: { tabs, fieldStates: { title: state('error') } }, attachTo: document.body })

    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test('each tab draws its focus ring when focused from the keyboard', () => {
    const wrapper = mount(ManagerTabs, { props: { tabs } })

    expect(wrapper.findAll('button').map(button => drawsFocusRing(button.classes()))).toEqual([true, true, true])
  })
})

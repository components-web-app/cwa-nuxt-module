// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DeleteLocationsDialog from './DeleteLocationsDialog.vue'

function mountDialog(total = 3) {
  return mount(DeleteLocationsDialog, {
    props: { total },
    global: {
      stubs: {
        DialogBox: {
          props: ['modelValue', 'buttons', 'title'],
          template: '<div v-if="modelValue"><h3>{{ title }}</h3><slot /><button v-for="b of buttons" :key="b.label" @click="b.callbackFn()">{{ b.label }}</button></div>',
        },
      },
    },
  })
}

function button(wrapper: ReturnType<typeof mountDialog>, label: string) {
  const found = wrapper.findAll('button').find(b => b.text() === label)
  if (!found) {
    throw new Error(`No button labelled ${label}`)
  }
  return found
}

describe('DeleteLocationsDialog', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('offers deleting from every location, removing from this one, or cancelling', () => {
    const wrapper = mountDialog(3)

    expect(wrapper.findAll('button').map(b => b.text())).toEqual([
      'Delete from all 3 locations',
      'Remove from this location only',
      'Cancel',
    ])
    expect(wrapper.text()).toContain('used in 3 locations')
  })

  test('Delete from all X locations confirms with all', async () => {
    const wrapper = mountDialog()

    await button(wrapper, 'Delete from all 3 locations').trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([['all']])
  })

  test('Remove from this location only confirms with here', async () => {
    const wrapper = mountDialog()

    await button(wrapper, 'Remove from this location only').trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([['here']])
  })

  test('Cancel cancels without confirming', async () => {
    vi.useFakeTimers()
    const wrapper = mountDialog()

    await button(wrapper, 'Cancel').trigger('click')
    vi.runAllTimers()

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })
})

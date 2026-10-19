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
          emits: ['update:modelValue'],
          template: '<div v-if="modelValue"><h3>{{ title }}</h3><slot /><button v-for="b of buttons" :key="b.label" :data-color="b.color" @click="b.callbackFn()">{{ b.label }}</button><button class="escape" @click="$emit(\'update:modelValue\', false)" /></div>',
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

  test('offers removing from this location first, so it is focused and primary, then deleting from every location as a danger, then cancelling', () => {
    const wrapper = mountDialog(3)

    expect(wrapper.findAll('button:not(.escape)').map(b => [b.text(), b.attributes('data-color')])).toEqual([
      ['Remove from this location only', 'blue'],
      ['Delete from all 3 locations', 'error'],
      ['Cancel', 'grey'],
    ])
    expect(wrapper.text()).toContain('used in 3 locations')
  })

  test('closing the dialog another way, as Escape does, cancels it', async () => {
    vi.useFakeTimers()
    const wrapper = mountDialog()

    await wrapper.find('button.escape').trigger('click')
    vi.runAllTimers()

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  test('a choice is not also answered as a cancel when the dialog closes', async () => {
    vi.useFakeTimers()
    const wrapper = mountDialog()

    await button(wrapper, 'Remove from this location only').trigger('click')
    vi.runAllTimers()

    expect(wrapper.emitted('confirm')).toEqual([['here']])
    expect(wrapper.emitted('cancel')).toBeUndefined()
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

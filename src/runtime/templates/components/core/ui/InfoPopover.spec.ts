// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { drawsFocusRing } from '../../../../../../test/utils/focus-ring'
import InfoPopover from './InfoPopover.vue'

enableAutoUnmount(afterEach)

describe('InfoPopover (#461)', () => {
  test('the info button draws its focus ring when focused from the keyboard', () => {
    const wrapper = mount(InfoPopover, { props: { label: 'Reference', text: 'Only admins see this.', textId: 'reference-info' } })

    expect(drawsFocusRing(wrapper.get('[data-testid="field-info"]').classes())).toBe(true)
  })
})

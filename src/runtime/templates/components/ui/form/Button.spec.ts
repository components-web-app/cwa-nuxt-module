// @vitest-environment nuxt
import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from './Button.vue'

describe('CwaUiFormButton', () => {
  test('the options button is named More actions for screen readers (#414)', () => {
    const wrapper = mount(Button, {
      props: { options: [{ label: 'Clone', value: 'clone' }] },
      slots: { default: () => 'Publish' },
    })

    expect(wrapper.get('[data-testid="button-options"]').attributes('aria-label')).toBe('More actions')
  })
})

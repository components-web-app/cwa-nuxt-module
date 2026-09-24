// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ModalSelect from './ModalSelect.vue'

const options = [
  { label: 'Live', value: 'live' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Not live', value: 'draft' },
]

async function openAndClick(modelValue: string, label: string) {
  const wrapper = mount(ModalSelect, {
    attachTo: document.body,
    props: { label: 'Visibility', modelValue, options },
  })
  await wrapper.find('button').trigger('click')
  await new Promise(resolve => setTimeout(resolve, 0))
  const option = Array.from(document.body.querySelectorAll('li')).find(item => item.textContent?.trim() === label)
  ;(option as HTMLElement | undefined)?.click()
  await new Promise(resolve => setTimeout(resolve, 0))
  const emitted = wrapper.emitted('update:modelValue')
  wrapper.unmount()
  return emitted
}

describe('ModalSelect', () => {
  test('emits the option the user picks', async () => {
    expect(await openAndClick('live', 'Not live')).toEqual([['draft']])
  })

  test('emits the option that is already selected when it is picked again', async () => {
    expect(await openAndClick('live', 'Live')).toEqual([['live']])
  })
})

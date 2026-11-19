// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { announceKey } from './field-keys'
import CopyButton from './CopyButton.vue'
import CwaUiButton from '../../ui/Button.vue'
import CopyGlyph from './CopyGlyph.vue'

enableAutoUnmount(afterEach)

function mountCopy(writeText: (text: string) => Promise<void>) {
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  const announce = vi.fn()
  const wrapper = mount(CopyButton, {
    props: { text: '/component/abc', label: 'Copy ID', copied: 'ID copied', failed: 'The ID couldn\'t be copied' },
    global: { provide: { [announceKey as symbol]: announce } },
  })
  return { wrapper, announce }
}

describe('CopyButton (#461)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('is the kit\'s icon-only small ghost button with the copy glyph, named by its label', () => {
    const { wrapper } = mountCopy(vi.fn())
    const button = wrapper.getComponent(CwaUiButton)
    expect(button.props()).toMatchObject({ variant: 'ghost', size: 'sm', iconOnly: true, icon: CopyGlyph, label: 'Copy ID' })
    expect(wrapper.get('button').attributes('aria-label')).toBe('Copy ID')
  })

  test('writes its text to the clipboard and announces that it was copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const { wrapper, announce } = mountCopy(writeText)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('/component/abc')
    expect(announce).toHaveBeenCalledWith('ID copied')
  })

  test('announces that it could not copy when the clipboard refuses', async () => {
    const { wrapper, announce } = mountCopy(vi.fn().mockRejectedValue(new Error('denied')))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(announce).toHaveBeenCalledWith('The ID couldn\'t be copied')
    expect(announce).not.toHaveBeenCalledWith('ID copied')
  })
})

// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { announceKey } from '../ui/field-keys'
import CopyableText from './CopyableText.vue'
import CopyButton from '../ui/CopyButton.vue'

enableAutoUnmount(afterEach)

function mountCopyable(props: { text: string, kind?: 'id' | 'path' }, options: { slot?: string, attrs?: Record<string, string> } = {}) {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  const announce = vi.fn()
  const wrapper = mount(CopyableText, {
    props,
    attrs: options.attrs,
    slots: options.slot ? { default: options.slot } : undefined,
    global: { provide: { [announceKey as symbol]: announce } },
  })
  return { wrapper, writeText, announce }
}

describe('CopyableText (#461)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('shows the text with the given classes and copies exactly that text as an ID', async () => {
    const { wrapper, writeText, announce } = mountCopyable({ text: '/component/abc' }, { attrs: { 'class': 'cwa:font-mono', 'data-testid': 'shown' } })
    expect(wrapper.get('[data-testid="shown"]').text()).toBe('/component/abc')
    expect(wrapper.get('[data-testid="shown"]').classes()).toContain('cwa:font-mono')
    expect(wrapper.getComponent(CopyButton).props()).toMatchObject({ label: 'Copy ID /component/abc', copied: 'ID copied', failed: 'The ID couldn\'t be copied' })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('/component/abc')
    expect(announce).toHaveBeenCalledWith('ID copied')
  })

  test('a path is copied as a path', async () => {
    const { wrapper, writeText, announce } = mountCopyable({ text: 'files/a.png', kind: 'path' })
    expect(wrapper.getComponent(CopyButton).props()).toMatchObject({ label: 'Copy path files/a.png', copied: 'Path copied', failed: 'The path couldn\'t be copied' })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('files/a.png')
    expect(announce).toHaveBeenCalledWith('Path copied')
  })

  test('shows its slot in place of the plain text, such as a link to the resource', () => {
    const { wrapper } = mountCopyable({ text: '/component/abc' }, { slot: '<a href="#" data-testid="link">/component/abc</a>' })
    expect(wrapper.get('[data-testid="link"]').text()).toBe('/component/abc')
    expect(wrapper.findAll('span > span')).toHaveLength(0)
  })

  test('the button sits on the first line of the text without making it taller, at both pointer sizes', () => {
    const { wrapper } = mountCopyable({ text: '/component/abc' })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:flex', 'cwa:items-start']))
    expect(wrapper.get('button').classes()).toEqual(expect.arrayContaining(['cwa:h-8', 'cwa:-my-1.5', 'cwa:pointer-coarse:h-hit', 'cwa:pointer-coarse:-my-3']))
  })
})

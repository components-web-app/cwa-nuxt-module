// @vitest-environment nuxt
import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import FormSection from './FormSection.vue'

function grid(count: number, columns: 1 | 2 = 2, hidden = 0) {
  const wrapper = mount(FormSection, {
    props: { title: 'Appearance', columns },
    slots: {
      default: () => [
        ...Array.from({ length: count }, (_, index) => h('div', { 'data-testid': 'item' }, `Item ${index}`)),
        ...Array.from({ length: hidden }, () => null),
      ],
    },
  })
  return wrapper.get('[data-testid="form-section-grid"]').classes()
}

describe('CwaUiFormSection grid (#461)', () => {
  test('one item is full width', () => {
    expect(grid(1)).toEqual(['cwa:grid', 'cwa:grid-cols-1', 'cwa:gap-y-stack', 'cwa:gap-x-4'])
  })

  test('two items share a row once the section is wide enough, else stack', () => {
    expect(grid(2)).toContain('cwa:@lg:grid-cols-2')
    expect(grid(2)).not.toContain('cwa:@lg:*:first:col-span-2')
  })

  test('three items put the first on its own full row and the other two side by side, as the old Appearance did, never leaving an empty cell; narrow, they stack', () => {
    expect(grid(3)).toEqual(expect.arrayContaining(['cwa:grid-cols-1', 'cwa:@lg:grid-cols-2', 'cwa:@lg:*:first:col-span-2']))
  })

  test('an item rendered as nothing (a v-if, Style with no options) is not counted, so two items still share a row', () => {
    expect(grid(2, 2, 1)).toContain('cwa:@lg:grid-cols-2')
    expect(grid(2, 2, 1)).not.toContain('cwa:@lg:*:first:col-span-2')
  })

  test('four items fill two rows of two; five give the first its own row too', () => {
    expect(grid(4)).not.toContain('cwa:@lg:*:first:col-span-2')
    expect(grid(5)).toEqual(expect.arrayContaining(['cwa:@lg:grid-cols-2', 'cwa:@lg:*:first:col-span-2']))
  })

  test('a one-column section always stacks', () => {
    expect(grid(3, 1).some(name => /grid-cols-2|col-span/.test(name))).toBe(false)
  })
})

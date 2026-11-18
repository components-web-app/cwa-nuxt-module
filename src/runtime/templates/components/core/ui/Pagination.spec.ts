// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { axe } from '../../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../../test/utils/focus-ring'
import Pagination from './Pagination.vue'

enableAutoUnmount(afterEach)

function mountPagination(page: number, total = 143, perPage = 20) {
  const wrapper = mount(Pagination, {
    props: { page, total, perPage, 'onUpdate:page': (value: number) => wrapper.setProps({ page: value }) },
    attachTo: document.body,
  })
  return wrapper
}

const pages = (wrapper: ReturnType<typeof mountPagination>) => wrapper.findAll('[data-testid="pagination-page"]').map(button => button.text())

describe('Pagination (#461)', () => {
  test('says which items are shown out of how many', () => {
    expect(mountPagination(1).get('[data-testid="pagination-range"]').text()).toBe('1–20 of 143')
    expect(mountPagination(8).get('[data-testid="pagination-range"]').text()).toBe('141–143 of 143')
  })

  test('shows every page when there are seven or fewer, the current one marked', () => {
    const wrapper = mountPagination(2, 60)

    expect(pages(wrapper)).toEqual(['1', '2', '3'])
    expect(wrapper.findAll('[aria-current="page"]').map(button => button.text())).toEqual(['2'])
  })

  test('with many pages, keeps the first, the last and those around the current one', () => {
    expect(pages(mountPagination(1, 400))).toEqual(['1', '2', '3', '4', '5', '20'])
    expect(pages(mountPagination(4, 400))).toEqual(['1', '2', '3', '4', '5', '20'])
    expect(pages(mountPagination(10, 400))).toEqual(['1', '9', '10', '11', '20'])
    expect(pages(mountPagination(17, 400))).toEqual(['1', '16', '17', '18', '19', '20'])
    expect(pages(mountPagination(20, 400))).toEqual(['1', '16', '17', '18', '19', '20'])
  })

  test('a page button, Previous and Next report the page to show', async () => {
    const wrapper = mountPagination(2)

    await wrapper.findAll('[data-testid="pagination-page"]').find(button => button.text() === '4')!.trigger('click')
    await wrapper.get('[data-testid="pagination-previous"]').trigger('click')
    await wrapper.get('[data-testid="pagination-next"]').trigger('click')

    expect(wrapper.emitted('update:page')).toEqual([[4], [3], [4]])
  })

  test('Previous on the first page and Next on the last do nothing and say they are unavailable', async () => {
    const first = mountPagination(1, 40)
    await first.get('[data-testid="pagination-previous"]').trigger('click')
    expect(first.get('[data-testid="pagination-previous"]').attributes('aria-disabled')).toBe('true')
    expect(first.emitted('update:page')).toBeUndefined()

    const last = mountPagination(2, 40)
    await last.get('[data-testid="pagination-next"]').trigger('click')
    await last.get('[data-testid="pagination-phone-next"]').trigger('click')
    expect(last.get('[data-testid="pagination-next"]').attributes('aria-disabled')).toBe('true')
    expect(last.emitted('update:page')).toBeUndefined()
  })

  test('on a phone it reads Previous, "Page 2 of 8", Next', async () => {
    const wrapper = mountPagination(2)

    expect(wrapper.text()).toContain('Page 2 of 8')
    await wrapper.get('[data-testid="pagination-phone-previous"]').trigger('click')
    expect(wrapper.emitted('update:page')).toEqual([[1]])
  })

  test('every button draws the keyboard focus ring', () => {
    const wrapper = mountPagination(2)

    expect(wrapper.findAll('button').every(button => drawsFocusRing(button.classes()))).toBe(true)
  })

  test.each([1, 4, 8])('on page %s it has no axe violations', async (page) => {
    mountPagination(page)

    expect(await axe(document.body)).toHaveNoViolations()
  })
})

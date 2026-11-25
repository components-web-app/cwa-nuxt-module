// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import { drawsFocusRing, fadesFocusRingFromText } from '../../../../../test/utils/focus-ring'
import DataTable from './DataTable.vue'
import type { DataTableColumn } from './DataTable.vue'
import Badge from './Badge.vue'

const columns: DataTableColumn[] = [
  { key: 'product', label: 'Product' },
  { key: 'quantity', label: 'Qty', align: 'end' },
  { key: 'total', label: 'Total', align: 'end' },
]

const rows = [
  { product: 'Tea', quantity: 2, total: 1200 },
  { product: 'Cup', quantity: 1, total: null },
]

type CellProps = { row: Record<string, unknown>, column: DataTableColumn, value: unknown }

describe('CwaUiDataTable', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('is a real table named by its caption, with a column header per column', () => {
    const wrapper = mount(DataTable, { props: { columns, rows, label: 'Order lines' } })

    const table = wrapper.get('table')
    expect(table.get('caption').text()).toBe('Order lines')
    const headers = table.findAll('thead th')
    expect(headers.map(th => th.text())).toEqual(['Product', 'Qty', 'Total'])
    expect(headers.every(th => th.attributes('scope') === 'col')).toBe(true)
  })

  test('renders each row\'s values as text in column order', () => {
    const wrapper = mount(DataTable, { props: { columns, rows, label: 'Order lines' } })

    const cells = wrapper.findAll('[data-testid="data-table-row"]').map(row => row.findAll('td').map(td => td.text()))
    expect(cells[0]).toEqual(['Tea', '2', '1200'])
    expect(cells[1]![0]).toBe('Cup')
  })

  test('an empty cell shows an em dash read out as "Not set", as CwaUiDetailList does', () => {
    const wrapper = mount(DataTable, { props: { columns, rows, label: 'Order lines' } })

    const cell = wrapper.findAll('[data-testid="data-table-row"]')[1]!.findAll('td')[2]!
    expect(cell.get('[aria-hidden="true"]').text()).toBe('—')
    expect(cell.get('.cwa\\:sr-only').text()).toBe('Not set')
  })

  test('an end-aligned column is right-aligned with even figures, header and cells alike; others start-aligned', () => {
    const wrapper = mount(DataTable, { props: { columns, rows, label: 'Order lines' } })

    const [product, quantity] = wrapper.findAll('thead th')
    expect(quantity!.classes()).toEqual(expect.arrayContaining(['cwa:text-end', 'cwa:tabular-nums']))
    expect(product!.classes()).toContain('cwa:text-start')
    expect(product!.classes()).not.toContain('cwa:text-end')
    const [productCell, , totalCell] = wrapper.findAll('[data-testid="data-table-row"]')[0]!.findAll('td')
    expect(totalCell!.classes()).toEqual(expect.arrayContaining(['cwa:text-end', 'cwa:tabular-nums']))
    expect(productCell!.classes()).not.toContain('cwa:text-end')
  })

  test('the cell slot formats a cell from its row, column and value, and returning the value keeps the rest as text', () => {
    const wrapper = mount(DataTable, {
      props: { columns, rows, label: 'Order lines' },
      slots: {
        cell: ({ row, column, value }: CellProps) =>
          column.key === 'total' ? `£${((value as number | null) ?? 0) / 100} (${row.product})` : String(value),
      },
    })

    const first = wrapper.findAll('[data-testid="data-table-row"]')[0]!.findAll('td').map(td => td.text())
    expect(first).toEqual(['Tea', '2', '£12 (Tea)'])
  })

  test('with no rows it keeps its headers and shows the empty text across every column', () => {
    const wrapper = mount(DataTable, { props: { columns, rows: [], label: 'Payments', empty: 'No payments yet' } })

    expect(wrapper.findAll('thead th')).toHaveLength(3)
    expect(wrapper.findAll('[data-testid="data-table-row"]')).toHaveLength(0)
    const cell = wrapper.get('[data-testid="data-table-empty"] td')
    expect(cell.text()).toBe('No payments yet')
    expect(cell.attributes('colspan')).toBe('3')
  })

  test('the empty text defaults to "None"', () => {
    const wrapper = mount(DataTable, { props: { columns, rows: [], label: 'Payments' } })

    expect(wrapper.get('[data-testid="data-table-empty"]').text()).toBe('None')
  })

  test('scrolls sideways inside its own box, so a wide table never makes the page scroll at 390px, and that box can be scrolled from the keyboard with a visible focus ring', () => {
    const wrapper = mount(DataTable, { props: { columns, rows, label: 'Order lines' } })

    const box = wrapper.get('[data-testid="data-table"]')
    expect(box.classes()).toEqual(expect.arrayContaining(['cwa:overflow-x-auto', 'cwa:min-w-0', 'cwa:max-w-full']))
    expect(box.attributes('tabindex')).toBe('0')
    expect(box.attributes('role')).toBe('group')
    expect(box.attributes('aria-labelledby')).toBe(wrapper.get('caption').attributes('id'))
    expect(drawsFocusRing(box.classes())).toBe(true)
    expect(fadesFocusRingFromText(box.classes())).toBe(false)
  })

  test('a row can hold another table through the cell slot, such as a bundle line\'s allocations, each with its own name and headers', () => {
    const lines = [{ product: 'Bundle', quantity: 1, total: 3000, allocations: [{ item: 'Tea', share: 2000 }, { item: 'Cup', share: 1000 }] }]
    const wrapper = mount(DataTable, {
      props: { columns: [...columns, { key: 'allocations', label: 'Allocations' }], rows: lines, label: 'Order lines' },
      slots: {
        cell: ({ column, value }: CellProps) => column.key === 'allocations'
          ? h(DataTable, { columns: [{ key: 'item', label: 'Item' }, { key: 'share', label: 'Share', align: 'end' }], rows: value as Record<string, unknown>[], label: 'Allocations' })
          : String(value),
      },
    })

    const tables = wrapper.findAll('table')
    expect(tables).toHaveLength(2)
    const inner = tables[1]!
    expect(inner.get('caption').text()).toBe('Allocations')
    expect(inner.findAll('th').map(th => th.text())).toEqual(['Item', 'Share'])
    expect(inner.findAll('[data-testid="data-table-row"]').map(row => row.findAll('td').map(td => td.text()))).toEqual([['Tea', '2000'], ['Cup', '1000']])
    expect(tables[0]!.findAll(':scope > tbody > [data-testid="data-table-row"]')).toHaveLength(1)
    const captionIds = wrapper.findAll('caption').map(caption => caption.attributes('id'))
    expect(new Set(captionIds).size).toBe(2)
  })

  describe('has no axe violations', () => {
    test.each([
      ['with rows', rows],
      ['with no rows', []],
    ])('%s', async (_, tableRows) => {
      const wrapper = mount(DataTable, { props: { columns, rows: tableRows, label: 'Order lines' }, attachTo: document.body })
      expect(await axe(wrapper.element)).toHaveNoViolations()
    })

    test('with a badge and a nested table in its cells', async () => {
      const wrapper = mount(DataTable, {
        props: { columns: [{ key: 'status', label: 'Status' }, { key: 'allocations', label: 'Allocations' }], rows: [{ status: 'paid', allocations: [{ item: 'Tea' }] }], label: 'Order lines' },
        slots: {
          cell: ({ column, value }: CellProps) => column.key === 'status'
            ? h(Badge, { tone: 'success' }, () => String(value))
            : h(DataTable, { columns: [{ key: 'item', label: 'Item' }], rows: value as Record<string, unknown>[], label: 'Allocations' }),
        },
        attachTo: document.body,
      })
      expect(await axe(wrapper.element)).toHaveNoViolations()
    })
  })
})

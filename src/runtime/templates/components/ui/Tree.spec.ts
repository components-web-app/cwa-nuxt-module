// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../test/utils/focus-ring'
import Tree from './Tree.vue'
import type { TreeAction, TreeNode } from './Tree.vue'
import BinIcon from './icon/BinIcon.vue'

enableAutoUnmount(afterEach)

const nodes: TreeNode[] = [
  { key: '/shaker', label: '/shaker', children: [{ key: '/shaker-style', label: '/shaker-style' }] },
  { key: '/old-kitchens', label: '/old-kitchens' },
]

function mountTree(props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) {
  const remove = vi.fn()
  const actions = (node: TreeNode): TreeAction[] => [{ label: `Delete the redirect from ${node.label}`, icon: BinIcon, danger: true, delete: true, run: remove }]
  const wrapper = mount(Tree, { props: { label: 'Redirected from', nodes, actions, ...props }, slots, attachTo: document.body })
  return { wrapper, remove }
}

const rows = () => [...document.querySelectorAll<HTMLElement>('[role="row"]')]
const row = (label: string) => rows().find(element => element.querySelector('[data-testid="tree-label"]')?.textContent?.trim() === label)!
const key = (element: Element, name: string, extra: KeyboardEventInit = {}) => element.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...extra }))

describe('CwaUiTree (#461)', () => {
  test('is a treegrid of rows with their level, position and expanded state, one tab stop on the first row', async () => {
    mountTree()
    await flushPromises()

    const grid = document.querySelector('[role="treegrid"]')!
    expect(grid.getAttribute('aria-label')).toBe('Redirected from')
    expect(rows().map(element => [element.getAttribute('aria-level'), element.getAttribute('aria-posinset'), element.getAttribute('aria-setsize'), element.getAttribute('aria-expanded')])).toEqual([
      ['1', '1', '2', 'true'],
      ['2', '1', '1', null],
      ['1', '2', '2', null],
    ])
    expect(rows().map(element => element.tabIndex)).toEqual([0, -1, -1])
    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('indents each level by 1.5rem', async () => {
    mountTree()
    await flushPromises()

    expect(row('/shaker-style').querySelector<HTMLElement>('[data-testid="tree-indent"]')!.style.width).toBe('1.5rem')
    expect(row('/shaker').querySelector<HTMLElement>('[data-testid="tree-indent"]')!.style.width).toBe('0rem')
  })

  test('a row with children draws a chevron, a leaf a spacer of the same width', async () => {
    mountTree()
    await flushPromises()

    expect(row('/shaker').querySelector('[data-testid="tree-chevron"]')).not.toBeNull()
    expect(row('/old-kitchens').querySelector('[data-testid="tree-chevron"]')).toBeNull()
    expect(row('/old-kitchens').querySelector('[data-testid="tree-spacer"]')).not.toBeNull()
  })

  test('a nested row is joined to its parent by an elbow, and a parent\'s line runs on past a nested row when it has a later sibling', async () => {
    mountTree({ nodes: [
      { key: 'a', label: '/a', children: [{ key: 'a1', label: '/a1', children: [{ key: 'a1x', label: '/a1x' }] }, { key: 'a2', label: '/a2' }] },
    ] })
    await flushPromises()

    expect(row('/a').querySelector('[data-testid="tree-elbow"]')).toBeNull()
    expect(row('/a1').querySelector('[data-testid="tree-elbow"]')!.getAttribute('data-last')).toBe('false')
    expect(row('/a2').querySelector('[data-testid="tree-elbow"]')!.getAttribute('data-last')).toBe('true')
    expect(row('/a1x').querySelectorAll('[data-testid="tree-guide"]')).toHaveLength(1)
    expect(row('/a2').querySelectorAll('[data-testid="tree-guide"]')).toHaveLength(0)
  })

  test('up, down, Home and End move the tab stop between visible rows', async () => {
    mountTree()
    await flushPromises()
    rows()[0]!.focus()

    key(document.activeElement!, 'ArrowDown')
    await flushPromises()
    expect(document.activeElement).toBe(row('/shaker-style'))
    expect(row('/shaker-style').tabIndex).toBe(0)
    expect(row('/shaker').tabIndex).toBe(-1)
    key(document.activeElement!, 'End')
    await flushPromises()
    expect(document.activeElement).toBe(row('/old-kitchens'))
    key(document.activeElement!, 'ArrowUp')
    await flushPromises()
    expect(document.activeElement).toBe(row('/shaker-style'))
    key(document.activeElement!, 'Home')
    await flushPromises()
    expect(document.activeElement).toBe(row('/shaker'))
  })

  test('Left closes an open row, then moves to the parent; Right opens a closed row, then moves into its first action', async () => {
    mountTree()
    await flushPromises()
    row('/shaker').focus()

    key(row('/shaker'), 'ArrowLeft')
    await flushPromises()
    expect(row('/shaker').getAttribute('aria-expanded')).toBe('false')
    expect(row('/shaker-style')).toBeUndefined()

    key(row('/shaker'), 'ArrowRight')
    await flushPromises()
    expect(row('/shaker').getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(row('/shaker'))

    key(row('/shaker'), 'ArrowRight')
    await flushPromises()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Delete the redirect from /shaker')

    row('/shaker-style').focus()
    key(row('/shaker-style'), 'ArrowLeft')
    await flushPromises()
    expect(document.activeElement).toBe(row('/shaker'))
  })

  test.each(['ArrowLeft', 'Escape'])('%s from an action returns to its row and goes no further', async (name) => {
    mountTree()
    await flushPromises()
    const outer = vi.fn()
    document.body.addEventListener('keydown', outer)
    const action = row('/old-kitchens').querySelector<HTMLElement>('[data-testid="tree-action"]')!
    action.focus()

    key(action, name)
    await flushPromises()
    document.body.removeEventListener('keydown', outer)

    expect(document.activeElement).toBe(row('/old-kitchens'))
    expect(outer).not.toHaveBeenCalled()
  })

  test('Enter runs the row\'s first action and Delete its delete action, naming the node', async () => {
    const { remove } = mountTree()
    await flushPromises()

    key(row('/old-kitchens'), 'Enter')
    key(row('/shaker'), 'Delete')
    await flushPromises()

    expect(remove.mock.calls.map(([node]) => node.key)).toEqual(['/old-kitchens', '/shaker'])
  })

  test('Delete on a row with no delete action does nothing', async () => {
    const run = vi.fn()
    mountTree({ actions: () => [{ label: 'Edit', run }] })
    await flushPromises()

    const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })
    row('/old-kitchens').dispatchEvent(event)
    await flushPromises()

    expect(run).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  test('keys pressed on an action are its own: Enter there does not also run the row\'s first action', async () => {
    const { remove } = mountTree()
    await flushPromises()

    key(row('/old-kitchens').querySelector('[data-testid="tree-action"]')!, 'Enter')
    await flushPromises()

    expect(remove).not.toHaveBeenCalled()
  })

  test('top-level rows are not joined to each other, so a nested row draws only its own elbow', async () => {
    mountTree({ nodes: [{ key: 'a', label: '/a', children: [{ key: 'a1', label: '/a1' }] }, { key: 'b', label: '/b' }] })
    await flushPromises()

    expect(row('/a1').querySelectorAll('[data-testid="tree-guide"]')).toHaveLength(0)
    expect(row('/b').querySelector('[data-testid="tree-elbow"]')).toBeNull()
  })

  test('actions are named for their row, out of the tab order, 2.5rem square and muted at rest, a destructive one included', async () => {
    mountTree()
    await flushPromises()

    const action = row('/old-kitchens').querySelector<HTMLElement>('[data-testid="tree-action"]')!
    expect(action.getAttribute('aria-label')).toBe('Delete the redirect from /old-kitchens')
    expect(action.tabIndex).toBe(-1)
    expect([...action.classList]).toEqual(expect.arrayContaining(['cwa:size-10', 'cwa:pointer-coarse:size-hit', 'cwa:text-fg-muted', 'cwa:hover:bg-step-hover', 'cwa:hover:text-danger-fg']))
    expect(drawsFocusRing([...action.classList])).toBe(true)
  })

  test('a menu action opens its menu from a ⋮ named for its row', async () => {
    const select = vi.fn()
    mountTree({ actions: (node: TreeNode) => [{ label: `More actions for ${node.label}`, menu: [{ label: 'Edit settings', value: 'edit', onSelect: () => select(node.key) }] }] })
    await flushPromises()

    const more = row('/old-kitchens').querySelector<HTMLElement>('[data-testid="tree-action"]')!
    expect(more.getAttribute('aria-label')).toBe('More actions for /old-kitchens')
    expect(more.getAttribute('aria-haspopup')).toBe('menu')
    expect(drawsFocusRing([...more.classList])).toBe(true)
  })

  test('rows draw their focus ring', async () => {
    mountTree()
    await flushPromises()

    expect(drawsFocusRing([...rows()[0]!.classList])).toBe(true)
  })

  test('a custom label and a badge per row', async () => {
    mountTree({}, {
      label: ({ node }: { node: TreeNode }) => h('span', { 'data-testid': 'custom' }, `${node.label} → this page`),
      badge: ({ node }: { node: TreeNode }) => h('span', { 'data-testid': 'badge' }, node.key === '/shaker' ? 'Live' : 'Not live'),
    })
    await flushPromises()

    expect(row('/shaker')).toBeUndefined()
    expect(document.querySelectorAll('[data-testid="custom"]')[0]!.textContent).toBe('/shaker → this page')
    expect([...document.querySelectorAll('[data-testid="badge"]')].map(element => element.textContent)).toEqual(['Live', 'Not live', 'Not live'])
  })

  test('says so when it is empty', async () => {
    mountTree({ nodes: [], empty: 'No old addresses send visitors here.' })
    await flushPromises()

    expect(document.querySelector('[role="treegrid"]')).toBeNull()
    expect(document.querySelector('[data-testid="tree-empty"]')!.textContent?.trim()).toBe('No old addresses send visitors here.')
  })

  test('the tab stop moves to the row clicked', async () => {
    mountTree()
    await flushPromises()

    row('/old-kitchens').click()
    await flushPromises()

    expect(rows().map(element => element.tabIndex)).toEqual([-1, -1, 0])
  })

  test('a click on the chevron opens and closes the row', async () => {
    mountTree()
    await flushPromises()

    row('/shaker').querySelector<HTMLElement>('[data-testid="tree-chevron"]')!.click()
    await flushPromises()

    expect(row('/shaker').getAttribute('aria-expanded')).toBe('false')
  })
})

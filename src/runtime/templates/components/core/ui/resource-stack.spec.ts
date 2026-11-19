import { describe, expect, test } from 'vitest'
import { placeResourceStack, resourceStackLevels } from './resource-stack'

const viewport = { width: 1280, height: 900 }
const boxes = { panel: { width: 160, height: 120 }, inner: { left: 20, top: 20, width: 120, height: 30 } }

function innerCorners({ left, top }: { left: number, top: number }) {
  const x = left + boxes.inner.left
  const y = top + boxes.inner.top
  return {
    'top-left': { x, y },
    'top-right': { x: x + boxes.inner.width, y },
    'bottom-left': { x, y: y + boxes.inner.height },
    'bottom-right': { x: x + boxes.inner.width, y: y + boxes.inner.height },
  }
}

describe('placeResourceStack at the pointer (#461)', () => {
  test('puts the innermost box\'s top-left corner exactly on the pointer when there is room', () => {
    const point = { x: 600, y: 400 }

    expect(innerCorners(placeResourceStack(point, boxes, viewport))['top-left']).toEqual(point)
  })

  test('near the right edge it puts the top-right corner on the pointer', () => {
    const point = { x: 1200, y: 400 }

    expect(innerCorners(placeResourceStack(point, boxes, viewport))['top-right']).toEqual(point)
  })

  test('near the bottom edge it puts the bottom-left corner on the pointer', () => {
    const point = { x: 600, y: 800 }

    expect(innerCorners(placeResourceStack(point, boxes, viewport))['bottom-left']).toEqual(point)
  })

  test('near the bottom-right it puts the bottom-right corner on the pointer', () => {
    const point = { x: 1200, y: 800 }

    expect(innerCorners(placeResourceStack(point, boxes, viewport))['bottom-right']).toEqual(point)
  })

  test('when no corner fits it shifts the panel to 8px inside the viewport', () => {
    const tall = { panel: { width: 300, height: 880 }, inner: { left: 20, top: 400, width: 100, height: 30 } }

    expect(placeResourceStack({ x: 4, y: 450 }, tall, viewport)).toEqual({ left: 8, top: 12 })
  })
})

describe('placeResourceStack over an element (#461)', () => {
  const anchor = { left: 590, top: 60, width: 120, height: 30 }

  test('puts the innermost name exactly on the element, so the outer levels grow around it', () => {
    const { left, top } = placeResourceStack({ ...anchor, width: 64, height: 18 }, boxes, viewport)

    expect(left + boxes.inner.left).toBe(590)
    expect(top + boxes.inner.top).toBe(60)
  })

  test('stays 8px inside the viewport', () => {
    expect(placeResourceStack({ left: 0, top: 0, width: 10, height: 10 }, boxes, viewport)).toEqual({ left: 8, top: 8 })
  })

  test('moves left of an element it must not cover, or below it when there is no room on the left', () => {
    const status = { left: 700, top: 50, width: 100, height: 40 }

    expect(placeResourceStack(anchor, boxes, viewport, status)).toEqual({ left: 532, top: 40 })
    expect(placeResourceStack({ ...anchor, left: 100 }, boxes, viewport, { ...status, left: 150 })).toEqual({ left: 80, top: 98 })
  })

  test('moved below an element it must not cover, it still stays 8px inside the bottom of the viewport', () => {
    const tall = { panel: { width: 160, height: 860 }, inner: boxes.inner }

    expect(placeResourceStack({ ...anchor, left: 100 }, tall, viewport, { left: 150, top: 50, width: 100, height: 40 })).toEqual({ left: 80, top: 32 })
  })
})

describe('resourceStackLevels (#461)', () => {
  test('keeps components, positions and groups, innermost first, keyed by their index in the stack, and never a page or layout', () => {
    const stack = [
      { iri: '/component/texts/1', displayName: 'Rich text' },
      { iri: '/_/component_positions/1', displayName: 'Component position' },
      { iri: '/_/component_groups/main', displayName: 'Main content group' },
      { iri: '/_/pages/1', displayName: 'Page' },
      { iri: '/_/layouts/1', displayName: 'Layout' },
    ]

    expect(resourceStackLevels(stack)).toEqual([
      { key: '0', label: 'Rich text' },
      { key: '1', label: 'Component position' },
      { key: '2', label: 'Main content group' },
    ])
  })

  test('names a level with no display name by its IRI', () => {
    expect(resourceStackLevels([{ iri: '/component/texts/1' }])).toEqual([{ key: '0', label: '/component/texts/1' }])
  })
})

// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { scrollerOf, spanOf, viewOf } from './reveal-geometry'
import { revealDelta } from './reveal'

function box(el: Element, top: number, height: number) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top, bottom: top + height, left: 0, right: 400, width: 400, height, x: 0, y: top, toJSON: () => ({}) } as DOMRect)
}

function size(el: Element, client: number, scroll: number) {
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: client })
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scroll })
}

function dialogBody() {
  document.body.innerHTML = `
    <div data-testid="scroller" style="overflow-y: auto">
      <div data-testid="header" data-cwa-sticky style="position: sticky; top: 0px">Back</div>
      <div data-testid="content">
        <div data-testid="revealed">Parent page</div>
      </div>
    </div>`
  const get = (id: string) => document.querySelector(`[data-testid="${id}"]`)!
  const scroller = get('scroller')
  size(scroller, 500, 1500)
  box(scroller, 100, 500)
  return { scroller, header: get('header'), revealed: get('revealed') }
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('reveal geometry (#461)', () => {
  test('the nearest scrolling ancestor is the container', () => {
    const { scroller, revealed } = dialogBody()
    box(revealed, 50, 40)

    expect(scrollerOf(revealed, 'y')).toBe(scroller)
  })

  test('a sticky header above the content shortens the view, so content scrolled up is not left under it', () => {
    const { scroller, header, revealed } = dialogBody()
    box(header, 100, 60)
    box(revealed, 120, 40)
    const target = spanOf(revealed, 'y')!

    const view = viewOf(scroller, 'y', target, revealed)
    expect(view).toEqual({ start: 160, end: 600 })
    expect(revealDelta(view, target)).toBe(-40)
  })

  test('scroll-padding is honoured as well', () => {
    const { scroller, header, revealed } = dialogBody()
    ;(scroller as HTMLElement).style.scrollPaddingBottom = '24px'
    box(header, 100, 60)
    box(revealed, 560, 40)
    const target = spanOf(revealed, 'y')!

    const view = viewOf(scroller, 'y', target, revealed)
    expect(view.end).toBe(576)
    expect(revealDelta(view, target)).toBe(24)
  })

  test('a display: contents wrapper is measured by what it holds', () => {
    document.body.innerHTML = '<div data-testid="wrapper" style="display: contents"><p data-testid="a">A</p><p data-testid="b">B</p></div>'
    box(document.querySelector('[data-testid="a"]')!, 300, 20)
    box(document.querySelector('[data-testid="b"]')!, 330, 40)

    expect(spanOf(document.querySelector('[data-testid="wrapper"]')!, 'y')).toEqual({ start: 300, end: 370 })
  })
})

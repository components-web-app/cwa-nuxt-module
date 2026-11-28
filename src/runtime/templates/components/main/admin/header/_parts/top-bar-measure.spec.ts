// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { measureTopBar } from './top-bar-measure'

function sized<T extends HTMLElement>(element: T, width: number) {
  Object.defineProperty(element, 'offsetWidth', { value: width, configurable: true })
  return element
}

function bar({ more }: { more?: number } = {}) {
  const list = document.createElement('ul')
  list.style.columnGap = '8px'
  Object.defineProperty(list, 'clientWidth', { value: 300, configurable: true })
  const home = sized(document.createElement('li'), 24)
  home.setAttribute('data-top-bar-home', '')
  list.append(home)
  for (const [id, width, hidden] of [['pages', 40, false], ['routes', 60, true], ['users', 30, false]] as const) {
    const item = sized(document.createElement('li'), width)
    item.dataset.topBarId = id
    item.hidden = hidden
    list.append(item)
  }
  if (more !== undefined) {
    const button = sized(document.createElement('li'), more)
    button.setAttribute('data-top-bar-more', '')
    list.append(button)
  }
  document.body.append(list)
  return list
}

describe('measureTopBar (#518)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('gives each shown link its width with one gap, the room left after the house, and leaves hidden links out', () => {
    expect(measureTopBar(bar())).toEqual({
      available: 300 + 8 - (24 + 8),
      widths: { pages: 48, users: 38 },
      more: 32,
    })
  })

  test('measures More once it shows', () => {
    expect(measureTopBar(bar({ more: 36 })).more).toBe(44)
  })
})

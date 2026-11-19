import { expect, test } from '@playwright/test'
import { controlRows } from './control-rows.mjs'

const widths = [1280, 390]
const kitBase = process.env.KIT_BASE

test.skip(!kitBase, 'Set KIT_BASE to a running playground, e.g. KIT_BASE=http://127.0.0.1:3417 pnpm run test:browser kit.spec.mjs')

async function openKit(page, width) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(`${kitBase}/kit`)
  await page.getByTestId('kit-presence').getByTestId('field-presence-flag').first().waitFor()
  await page.waitForFunction(() => !!document.querySelector('#__nuxt')?.__vue_app__, null, { timeout: 120000 })
}

async function settlePopover(page, testId) {
  await page.waitForFunction(id => document.querySelector(`[data-testid="${id}"]`)?.getAnimations().every(animation => animation.playState !== 'running'), testId)
}

function inkGaps(panel) {
  const box = panel.getBoundingClientRect()
  const context = document.createElement('canvas').getContext('2d')
  const caret = [...panel.children].filter(child => getComputedStyle(child).position === 'absolute')
  const ignored = element => element.closest('svg, .cwa\\:sr-only') || caret.some(part => part.contains(element))
  const filled = element => element !== panel && !['rgba(0, 0, 0, 0)', 'transparent'].includes(getComputedStyle(element).backgroundColor)
  const boxes = [...panel.querySelectorAll('*')].filter(element => !ignored(element) && filled(element) && element.getClientRects().length)
  const ink = boxes.filter(element => !boxes.some(other => other !== element && other.contains(element))).map(element => element.getBoundingClientRect())
  let wraps = false
  const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node.parentElement
    if (!node.textContent.trim() || ignored(element) || boxes.some(filledBox => filledBox.contains(element))) {
      continue
    }
    const style = getComputedStyle(element)
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const metrics = context.measureText('H')
    const range = document.createRange()
    range.selectNodeContents(node)
    const lines = [...range.getClientRects()].filter(rect => rect.width)
    wraps ||= new Set(lines.map(rect => Math.round(rect.top))).size > 1
    for (const line of lines) {
      const baseline = line.top + metrics.fontBoundingBoxAscent
      ink.push({ top: baseline - metrics.actualBoundingBoxAscent, bottom: baseline, left: line.left, right: line.right })
    }
  }
  return {
    top: Math.min(...ink.map(rect => rect.top)) - box.top,
    right: box.right - Math.max(...ink.map(rect => rect.right)),
    bottom: box.bottom - Math.max(...ink.map(rect => rect.bottom)),
    left: Math.min(...ink.map(rect => rect.left)) - box.left,
    wraps,
  }
}

const tooltipSurfaces = [
  ['an information popover, with its title and Close', 'field-info-popover', page => page.locator('main').getByTestId('field-info').first().click()],
  ['a disabled button\'s reason', 'button-reason', page => page.locator('main button[title="Nothing has changed since the last save"]').first().click({ force: true })],
  ['a field\'s error popover, ending in its buttons', 'field-status-popover', page => page.getByTestId('kit-input-error').locator('input').focus()],
  ['a field\'s conflict popover', 'field-status-popover', page => page.getByTestId('kit-input-conflict').locator('input').focus()],
]

for (const width of widths) {
  test(`kit at ${width}: a peer's flag and ring sit clear of every field's label in a manager row`, async ({ page }) => {
    await openKit(page, width)
    const bar = page.getByTestId('kit-presence')
    const fields = await bar.locator('[data-cwa-field], [data-testid="field-presence"]').count()
    expect(fields).toBeGreaterThan(0)

    const clashes = await bar.evaluate((root) => {
      const rect = element => element.getBoundingClientRect()
      const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
      const labels = [...root.querySelectorAll('label')].filter(label => label.getClientRects().length && !label.closest('.cwa\\:sr-only') && !label.classList.contains('cwa:sr-only'))
      const flags = [...document.querySelectorAll('[data-testid="field-presence-flag"]')]
      const rings = [...root.querySelectorAll('[data-testid="field-presence"]')]
      return {
        labels: labels.length,
        flags: flags.length,
        rings: rings.length,
        clashes: [...flags, ...rings].flatMap(mark => labels.filter(label => overlaps(rect(mark), rect(label))).map(label => `${mark.dataset.testid} over "${label.textContent.trim()}"`)),
      }
    })
    expect(clashes.flags).toBe(5)
    expect(clashes.rings).toBe(5)
    expect(clashes.labels).toBe(5)
    expect(clashes.clashes).toEqual([])
  })

  test(`kit at ${width}: the page never scrolls sideways, with every simulation's fields in a manager row`, async ({ page }) => {
    await openKit(page, width)
    const rows = page.locator('button', { hasText: /^Manager row$/ })
    for (let index = 0; index < await rows.count(); index++) {
      await rows.nth(index).scrollIntoViewIfNeeded()
      await expect(async () => {
        await rows.nth(index).click()
        await expect(rows.nth(index)).toHaveAttribute('data-state', 'on', { timeout: 500 })
      }).toPass()
    }
    await expect(page.locator('.kit-place-bar [data-testid="manager-tab"]')).toHaveCount(await rows.count())
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  })

  test(`kit at ${width}: an information popover stands 4 to 6px from its ⓘ glyph, not from the button's hit area (#461)`, async ({ page }) => {
    await openKit(page, width)
    await page.waitForLoadState('networkidle')
    const trigger = page.locator('main').getByTestId('field-info').first()
    await trigger.click()
    await page.getByTestId('field-info-popover').waitFor()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await settlePopover(page, 'field-info-popover')

    const gap = await trigger.evaluate((button) => {
      const glyph = button.querySelector('svg').getBoundingClientRect()
      const panel = document.querySelector('[data-testid="field-info-popover"]')
      const box = panel.getBoundingClientRect()
      const caret = [...panel.querySelectorAll('svg')].at(-1).getBoundingClientRect()
      return Math.max(glyph.top - Math.max(box.bottom, caret.bottom), Math.min(box.top, caret.top) - glyph.bottom)
    })
    expect(gap).toBeGreaterThanOrEqual(4)
    expect(gap).toBeLessThanOrEqual(6)
  })

  for (const [name, testId, open] of tooltipSurfaces) {
    test(`kit at ${width}: ${name} shows as much space above its text as below it and at its sides, measured to the letters, not to the boxes (#461)`, async ({ page }) => {
      await openKit(page, width)
      await page.waitForLoadState('networkidle')
      await open(page)
      await page.getByTestId(testId).waitFor()
      await settlePopover(page, testId)

      const gaps = await page.getByTestId(testId).evaluate(inkGaps)
      expect(Math.abs(gaps.top - gaps.left)).toBeLessThanOrEqual(1)
      expect(Math.abs(gaps.bottom - gaps.left)).toBeLessThanOrEqual(1)
      if (gaps.wraps) {
        expect(gaps.right).toBeGreaterThanOrEqual(gaps.left - 1)
      }
      else {
        expect(Math.abs(gaps.right - gaps.left)).toBeLessThanOrEqual(1)
      }
    })
  }

  test(`kit at ${width}: stacked demo rows never touch`, async ({ page }) => {
    await openKit(page, width)
    const touching = await page.locator('main').evaluate((main) => {
      const demo = element => !element.matches('h1, h2, h3, p, table, [hidden]') && element.getClientRects().length > 0
      const blocks = [...main.querySelectorAll('section *')].filter(element => demo(element) && element.parentElement && (element.parentElement.tagName === 'SECTION' || element.parentElement.classList.contains('kit-stack')))
      return blocks.flatMap((block) => {
        const next = block.nextElementSibling
        if (!next || !blocks.includes(next)) {
          return []
        }
        const space = next.getBoundingClientRect().top - block.getBoundingClientRect().bottom
        return space < 12 ? [`${block.className || block.tagName} then ${next.className || next.tagName}: ${Math.round(space)}px`] : []
      })
    })
    expect(touching).toEqual([])
  })
}

const floatingSurfaces = [
  ['the resource stack at the pointer', async (page) => {
    const area = page.getByTestId('kit-stack-area')
    await area.scrollIntoViewIfNeeded()
    const box = await area.boundingBox()
    await page.mouse.click(box.x + 40, box.y + 20, { button: 'right' })
  }],
  ['the resource stack over its button', page => page.getByRole('button', { name: 'Rich text' }).click()],
  ['the split button menu', page => page.getByTestId('kit-split').getByRole('button').last().click()],
  ['an information popover', page => page.locator('main').getByTestId('field-info').first().click()],
  ['a select menu', page => page.locator('main').getByTestId('select-trigger').first().click()],
  ['a multi-select menu', page => page.locator('main').getByTestId('multi-input').first().click()],
  ['a resource search menu', async (page) => {
    const input = page.locator('main').getByTestId('search-input').first()
    await input.click()
    await input.fill('a')
  }],
]

for (const [name, open] of floatingSurfaces) {
  test(`kit: ${name} is never painted before it is placed (#461)`, async ({ page }) => {
    await openKit(page, 1280)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => {
      window.cwaFloatingFrames = []
      const sample = () => {
        const wrappers = [...document.querySelectorAll('[data-reka-popper-content-wrapper]')]
        if (!wrappers.length && !window.cwaFloatingFrames.length) {
          requestAnimationFrame(sample)
          return
        }
        window.cwaFloatingFrames.push(wrappers.map((wrapper) => {
          const content = wrapper.firstElementChild
          const style = getComputedStyle(wrapper)
          const contentStyle = content ? getComputedStyle(content) : style
          const placement = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform)
          const rect = wrapper.getBoundingClientRect()
          return {
            id: content?.getAttribute('data-testid') ?? content?.getAttribute('role'),
            x: placement.e,
            y: placement.f,
            painted: style.visibility !== 'hidden' && contentStyle.visibility !== 'hidden' && Number(contentStyle.opacity) > 0 && rect.width > 0,
          }
        }))
        if (window.cwaFloatingFrames.length < 45) {
          requestAnimationFrame(sample)
        }
      }
      requestAnimationFrame(sample)
    })
    await open(page)
    await page.waitForFunction(() => window.cwaFloatingFrames.length >= 45)

    const frames = await page.evaluate(() => window.cwaFloatingFrames)
    const final = frames.at(-1)
    expect(final.filter(surface => surface.painted).length).toBeGreaterThan(0)
    const misplaced = frames.flatMap((frame, index) => frame.filter((surface) => {
      const placed = final.find(last => last.id === surface.id)
      return surface.painted && placed && (Math.abs(placed.x - surface.x) > 1 || Math.abs(placed.y - surface.y) > 1)
    }).map(surface => `frame ${index}: ${surface.id} at ${surface.x},${surface.y}`))
    expect(misplaced).toEqual([])
  })
}

for (const width of widths) {
  test(`kit at ${width}: a segmented control in a dialog is only as wide as its options (#461)`, async ({ page }) => {
    await openKit(page, width)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Dialog', exact: true }).first().click()
    const group = page.getByRole('group', { name: 'Align', exact: true }).first()
    await group.waitFor()

    const sizes = await group.evaluate((element) => {
      const field = element.closest('[data-cwa-field]') ?? element.parentElement.parentElement
      return {
        group: element.getBoundingClientRect().width,
        options: [...element.querySelectorAll('button')].reduce((sum, option) => sum + option.getBoundingClientRect().width, 0),
        column: field.getBoundingClientRect().width,
      }
    })
    expect(Math.abs(sizes.group - sizes.options)).toBeLessThanOrEqual(1)
    expect(sizes.group).toBeLessThan(sizes.column)
  })
}

for (const [width, height] of [[1280, 600], [390, 600]]) {
  test(`kit at ${width}×${height}: a choice in a slide-over reveals content below the fold, and it scrolls fully into view (#461)`, async ({ page }) => {
    await openKit(page, width)
    await page.setViewportSize({ width, height })
    const nesting = page.getByTestId('kit-reveal-nesting').getByRole('group')
    await expect(async () => {
      await page.getByTestId('kit-reveal-open').click()
      await nesting.waitFor({ state: 'attached', timeout: 1000 })
    }).toPass()
    const scroller = nesting.locator('xpath=ancestor::*[@data-cwa-scroll][1]')

    const placeControlAt = edge => nesting.evaluate((group, edge) => {
      const body = group.closest('[data-cwa-scroll]')
      const view = body.getBoundingClientRect()
      const control = group.getBoundingClientRect()
      const low = view.top + body.clientHeight
      body.scrollTop += edge === 'bottom' ? control.bottom - low : control.top - view.top - 8
      const placed = group.getBoundingClientRect()
      return edge === 'bottom' ? Math.abs(placed.bottom - low) < 2 : Math.abs(placed.top - view.top - 8) < 2
    }, edge)
    const choose = async (label) => {
      const option = nesting.getByRole('button', { name: label, exact: true })
      await expect(async () => {
        await option.focus()
        await page.keyboard.press('Enter')
        await expect(option).toHaveAttribute('aria-pressed', 'true', { timeout: 500 })
      }).toPass()
      return option
    }
    const inView = testId => page.getByTestId(testId).evaluate((element) => {
      const body = element.closest('[data-cwa-scroll]')
      const view = body.getBoundingClientRect()
      const box = element.getBoundingClientRect()
      return box.top >= view.top - 1 && box.bottom <= view.top + body.clientHeight + 1
    })

    expect(await placeControlAt('bottom')).toBe(true)
    expect(await inView('kit-reveal-nesting')).toBe(true)
    const option = await choose('Page data')
    await expect.poll(() => inView('kit-reveal-parent-data')).toBe(true)
    await expect(option).toBeFocused()

    await choose('Nothing')
    expect(await placeControlAt('top')).toBe(true)
    const before = await scroller.evaluate(body => body.scrollTop)
    await choose('Page data')
    await expect.poll(() => inView('kit-reveal-parent-data')).toBe(true)
    const after = await scroller.evaluate(body => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(body.scrollTop)))))
    expect(after).toBe(before)
  })
}

const stackOpenings = [
  ['at the pointer', floatingSurfaces[0][1]],
  ['over its button, as the header\'s path selector opens it', floatingSurfaces[1][1]],
]

for (const [name, open] of stackOpenings) {
  test(`kit: the resource stack opened ${name} never moves sideways while it appears (#461)`, async ({ page }) => {
    await openKit(page, 1280)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => {
      window.cwaStackFrames = []
      const sample = () => {
        const panel = document.querySelector('[data-testid="resource-stack"]')?.firstElementChild
        if (!panel && !window.cwaStackFrames.length) {
          requestAnimationFrame(sample)
          return
        }
        const rect = panel.getBoundingClientRect()
        const style = getComputedStyle(panel.parentElement)
        window.cwaStackFrames.push({ x: rect.left, y: rect.top, painted: style.visibility !== 'hidden' && Number(getComputedStyle(panel).opacity) > 0 })
        if (window.cwaStackFrames.length < 30) {
          requestAnimationFrame(sample)
        }
      }
      requestAnimationFrame(sample)
    })
    await open(page)
    await page.waitForFunction(() => window.cwaStackFrames.length >= 30)

    const frames = await page.evaluate(() => window.cwaStackFrames)
    const final = frames.at(-1)
    const painted = frames.filter(frame => frame.painted)
    expect(painted.length).toBeGreaterThan(0)
    expect(painted.filter(frame => Math.abs(frame.x - final.x) > 1)).toEqual([])
    expect(painted.filter(frame => frame.y > final.y + 1 || frame.y < final.y - 5)).toEqual([])
  })
}

for (const [selected, where, option] of [['0', 'innermost', 'Innermost'], ['4', 'outermost shown', 'Outermost shown'], ['1', 'second', 'Second']]) {
  test(`kit: with the ${where} level selected, the resource stack opens with the innermost name exactly over its button's, every name is centred in its level's box, and a selected name sits and measures as an unselected one with the same text (#461)`, async ({ page }) => {
    await openKit(page, 1280)
    await page.waitForLoadState('networkidle')
    const control = page.getByTestId('kit-stack-selected')
    await control.scrollIntoViewIfNeeded()
    await control.getByText(option, { exact: true }).click()
    const opener = page.getByTestId('kit-stack-open')
    await opener.click()
    const stack = page.getByTestId('resource-stack')
    await expect(stack.locator('[aria-selected="true"]')).toHaveCount(1)
    await expect.poll(() => stack.evaluate(panel => getComputedStyle(panel.firstElementChild.parentElement).visibility)).toBe('visible')
    await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished)))
    const measured = await page.evaluate(({ selected }) => {
      const label = (level) => {
        const box = level.getBoundingClientRect()
        const range = document.createRange()
        range.selectNodeContents(level.querySelector(':scope > [data-stack-name] [data-stack-label]'))
        const text = range.getBoundingClientRect()
        return { offset: (text.left + text.width / 2) - (box.left + box.width / 2), width: text.width, weight: getComputedStyle(level.querySelector(':scope > [data-stack-name]')).fontWeight }
      }
      const levels = [...document.querySelectorAll('[data-testid="resource-stack"] [role="treeitem"]')]
      const text = (element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        return range.getBoundingClientRect()
      }
      const opener = text(document.querySelector('[data-testid="kit-stack-open"] span:not([aria-hidden])'))
      const inner = text(document.querySelector('[data-stack-innermost] > [data-stack-name] [data-stack-label]'))
      const centred = levels.map((level) => {
        const box = level.getBoundingClientRect()
        const name = text(level.querySelector(':scope > [data-stack-name] [data-stack-label]'))
        return { label: level.getAttribute('aria-label'), off: (name.left + name.width / 2) - (box.left + box.width / 2) }
      })
      const chosen = levels.find(level => level.getAttribute('aria-selected') === 'true')
      const twin = levels.find(level => level !== chosen && level.getAttribute('aria-label') === chosen.getAttribute('aria-label'))
      return {
        over: { left: inner.left - opener.left, top: inner.top - opener.top },
        chosen: label(chosen),
        twin: twin ? label(twin) : undefined,
        centred,
        selected,
      }
    }, { selected })
    expect(measured.centred.length).toBeGreaterThanOrEqual(3)
    expect(measured.centred.filter(level => Math.abs(level.off) > 1)).toEqual([])
    expect(Math.abs(measured.over.left)).toBeLessThanOrEqual(1)
    expect(Math.abs(measured.over.top)).toBeLessThanOrEqual(1)
    if (measured.twin) {
      expect(Math.abs(measured.chosen.offset - measured.twin.offset)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(measured.chosen.width - measured.twin.width)).toBeLessThanOrEqual(0.5)
      expect(measured.chosen.weight).toBe(measured.twin.weight)
    }
    if (selected === '1') {
      expect(measured.twin).toBeDefined()
      await page.screenshot({ path: process.env.KIT_SCREENSHOT ?? 'test-results/kit-stack-selected.png', clip: await stack.locator('[role="tree"]').boundingBox() ?? undefined })
    }
  })
}

for (const width of widths) {
  for (const touch of [false, true]) {
    test(`kit at ${width}${touch ? ' with touch sizes' : ''}: an image field's buttons, thumbnail and Alt button share one height and one centre, in the bar and in a dialog (#461)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${kitBase}/kit`)
      await page.waitForLoadState('networkidle')
      if (touch) {
        await page.getByTestId('kit-toolbar-touch').getByRole('switch').click()
      }
      const measure = scope => scope.evaluate((root) => {
        const box = (element) => {
          const rect = element.getBoundingClientRect()
          return { height: rect.height, centre: rect.top + rect.height / 2 }
        }
        const parts = field => [
          field.querySelector('[data-testid="file-choose"]'),
          field.querySelector('[data-testid="file-remove"]'),
          field.querySelector('img, span[aria-hidden="true"]'),
        ].filter(Boolean)
        const chips = [...root.querySelectorAll('[data-testid="image-alt-chip"]')]
        return [
          ...[...root.querySelectorAll('[data-testid="file-upload"]')].map(field => parts(field).map(box)),
          ...chips.map(chip => [chip, ...parts(chip.parentElement.querySelector('[data-testid="file-upload"]'))].map(box)),
        ]
      })
      const expectAligned = (groups) => {
        expect(groups.length).toBeGreaterThan(0)
        for (const parts of groups) {
          expect(parts.length).toBeGreaterThanOrEqual(3)
          for (const part of parts) {
            expect(Math.abs(part.height - parts[0].height)).toBeLessThanOrEqual(1)
            expect(Math.abs(part.centre - parts[0].centre)).toBeLessThanOrEqual(1)
          }
        }
      }

      const bar = page.getByTestId('kit-image-alt-bar')
      await bar.scrollIntoViewIfNeeded()
      expectAligned(await measure(bar))
      expect(await bar.getByTestId('image-alt-chip').count()).toBe(1)

      await page.getByTestId('kit-image-alt-dialog-open').click()
      const dialog = page.getByTestId('dialog')
      await dialog.getByTestId('image-alt-chip').waitFor()
      expectAligned(await measure(dialog))
    })
  }
}

test('kit: only one field status popover shows at a time, and Close or Escape keeps it closed while the pointer and focus stay (#461)', async ({ page }) => {
  await openKit(page, 1280)
  const popovers = page.getByTestId('field-status-popover')
  const error = page.getByTestId('kit-input-error').locator('input')
  const conflict = page.getByTestId('kit-input-conflict').locator('input')
  const labels = () => popovers.evaluateAll(each => each.map(popover => popover.getAttribute('aria-label')))
  const HOVER_DELAY_PASSED = 700

  await error.scrollIntoViewIfNeeded()
  await error.hover()
  await expect(popovers).toHaveAttribute('aria-label', 'error: not saved')
  await conflict.hover()
  await expect(popovers).toHaveAttribute('aria-label', 'conflict: changed by Alex')
  expect(await labels()).toEqual(['conflict: changed by Alex'])

  await conflict.click()
  await error.hover()
  await expect(popovers).toHaveAttribute('aria-label', 'error: not saved')
  expect(await labels()).toEqual(['error: not saved'])
  await page.mouse.move(2, 450)
  await expect(popovers).toHaveAttribute('aria-label', 'conflict: changed by Alex')

  await popovers.getByRole('button', { name: 'Close' }).click()
  await expect(popovers).toHaveCount(0)
  await expect(conflict).toBeFocused()
  await conflict.hover()
  await page.waitForTimeout(HOVER_DELAY_PASSED)
  await expect(popovers).toHaveCount(0)

  await page.mouse.move(2, 450)
  await error.click()
  await expect(popovers).toHaveAttribute('aria-label', 'error: not saved')
  await page.keyboard.press('Escape')
  await expect(popovers).toHaveCount(0)
  await page.waitForTimeout(HOVER_DELAY_PASSED)
  await expect(popovers).toHaveCount(0)
  await expect(error).toBeFocused()

  await page.mouse.move(2, 450)
  await page.locator('body').evaluate(() => document.activeElement?.blur())
  await conflict.hover()
  await expect(popovers).toHaveAttribute('aria-label', 'conflict: changed by Alex')
  await popovers.getByRole('button', { name: 'Close' }).click()
  await expect(popovers).toHaveCount(0)
  await page.waitForTimeout(HOVER_DELAY_PASSED)
  await expect(popovers).toHaveCount(0)
  await expect(page.locator('body')).toBeFocused()
  await conflict.hover()
  await expect(popovers).toHaveAttribute('aria-label', 'conflict: changed by Alex')
})

test('kit: a field\'s focus ring fades in from transparent, never from white (#461)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${kitBase}/kit`)
  await page.waitForLoadState('networkidle')

  const frames = await page.evaluate(async () => {
    const ringed = [...document.querySelectorAll('main input:not([type="file"]):not([type="checkbox"])')]
      .map(input => [input, input.closest('[class*="focus-within:outline-accent-fg"]')])
      .filter(([input, ring]) => ring && input.getClientRects().length && !input.disabled)
      .slice(0, 8)
    const samples = []
    for (const [input, ring] of ringed) {
      input.scrollIntoView({ block: 'center' })
      await new Promise(resolve => requestAnimationFrame(resolve))
      input.focus()
      for (let frame = 0; frame < 12; frame++) {
        const style = getComputedStyle(ring)
        samples.push({ field: input.name || input.getAttribute('aria-label') || input.id, colour: style.outlineColor, style: style.outlineStyle })
        await new Promise(resolve => requestAnimationFrame(resolve))
      }
      input.blur()
    }
    return samples
  })

  const white = frames.filter(({ colour, style }) => {
    const [r, g, b, a = 1] = colour.match(/[\d.]+/g).map(Number)
    return style !== 'none' && a > 0.05 && r > 180 && g > 180 && b > 180
  })
  expect(new Set(frames.map(({ field }) => field)).size).toBeGreaterThanOrEqual(4)
  expect(frames.some(({ colour }) => colour === 'rgb(96, 165, 250)')).toBe(true)
  expect(white).toEqual([])
})

test('kit: a textarea beside its label lines the label up with its first line of text, and no manager row holds one (#461)', async ({ page }) => {
  const warnings = []
  page.on('console', message => message.text().includes('CwaUiTextarea') && warnings.push(message.text()))
  await openKit(page, 1280)
  const textarea = page.locator('[data-kit-field="textarea"]').first()
  await textarea.scrollIntoViewIfNeeded()
  const offset = await textarea.evaluate((field) => {
    const element = field.querySelector('textarea')
    const label = document.querySelector(`label[for="${element.id}"]`)
    const firstLine = (box) => {
      const style = getComputedStyle(box)
      const top = box.getBoundingClientRect().top + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.borderTopWidth)
      return top + Number.parseFloat(style.lineHeight) / 2
    }
    return firstLine(label) - firstLine(element)
  })
  expect(Math.abs(offset)).toBeLessThanOrEqual(1)

  const rows = page.locator('button', { hasText: /^Manager row$/ })
  for (let index = 0; index < await rows.count(); index++) {
    await rows.nth(index).scrollIntoViewIfNeeded()
    await expect(async () => {
      await rows.nth(index).click()
      await expect(rows.nth(index)).toHaveAttribute('data-state', 'on', { timeout: 500 })
    }).toPass()
  }
  await expect(page.locator('.kit-place-bar [data-testid="manager-tab"]')).toHaveCount(await rows.count())
  await expect(page.locator('.kit-place-bar [data-kit-field]').first()).toBeAttached()
  await expect(page.locator('.kit-place-bar [data-kit-field="textarea"]')).toHaveCount(0)
  expect(warnings).toEqual([])
})

for (const [width, height] of [[1280, 600], [390, 600]]) {
  test(`kit at ${width}×${height}: six toasts show the oldest 3 and "+3 more", which expands them all in a stack that scrolls within the window, and Dismiss all clears them`, async ({ page }) => {
    await openKit(page, width)
    await page.setViewportSize({ width, height })
    const toaster = page.getByTestId('toaster')
    const more = toaster.getByRole('button', { name: 'Show 3 more notifications' })
    await expect(async () => {
      await page.getByTestId('kit-toast-six').click()
      await expect(more).toBeVisible({ timeout: 500 })
    }).toPass()
    await expect(toaster.getByTestId('toast-title')).toHaveText(['Title wasn’t saved', 'Oops! There was a problem.', 'Mercure reconnected'])

    await more.click()
    await expect(toaster.getByTestId('toast-title')).toHaveCount(6)
    const list = toaster.getByTestId('toaster-list')
    const boxes = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect()
      const list = document.querySelector('[data-testid="toaster-list"]')
      return { list: rect('[data-testid="toaster-list"]'), row: rect('[data-testid="toaster-overflow"]'), scrolls: list.scrollHeight > list.clientHeight, page: document.documentElement.scrollWidth }
    })
    expect(boxes.list.top).toBeGreaterThanOrEqual(0)
    expect(boxes.row.bottom).toBeLessThanOrEqual(height)
    expect(boxes.scrolls).toBe(true)
    expect(boxes.page).toBeLessThanOrEqual(width)
    await list.evaluate(element => element.scrollTo({ top: element.scrollHeight }))
    await expect(toaster.getByTestId('toast-title').last()).toBeInViewport()

    await page.keyboard.press('Escape')
    await expect(toaster.getByTestId('toast-title')).toHaveCount(3)
    await toaster.getByRole('button', { name: 'Dismiss all 6 notifications' }).click()
    await expect(toaster.getByTestId('toast-title')).toHaveCount(0)
  })
}

for (const width of widths) {
  test(`kit at ${width}: a multi-select keeps its width and height when it opens and closes, and shows its count while open (#461)`, async ({ page }) => {
    await openKit(page, width)
    const anchor = page.locator('main').getByTestId('multi-input').first().locator('xpath=..')
    await anchor.scrollIntoViewIfNeeded()
    const closed = await anchor.boundingBox()

    await anchor.getByTestId('multi-input').click()
    await page.getByTestId('multi-menu').waitFor()
    await expect(anchor.getByTestId('multi-count')).toHaveText(/^\d+ selected$/)
    const opened = await anchor.boundingBox()
    await page.keyboard.press('Escape')
    await page.getByTestId('multi-menu').waitFor({ state: 'detached' })
    const reclosed = await anchor.boundingBox()

    for (const box of [opened, reclosed]) {
      expect(Math.abs(box.width - closed.width)).toBeLessThan(0.5)
      expect(Math.abs(box.height - closed.height)).toBeLessThan(0.5)
      expect(Math.abs(box.x - closed.x)).toBeLessThan(0.5)
      expect(Math.abs(box.y - closed.y)).toBeLessThan(0.5)
    }
  })
}

for (const hasTouch of [false, true]) {
  for (const width of widths) {
    const where = `${width} with a ${hasTouch ? 'coarse' : 'fine'} pointer`
    for (const open of [undefined, 'kit-dialog-open', 'kit-image-alt-dialog-open', 'kit-sim-dialogs-open']) {
      test(`kit at ${where}: every single-line field, grouped control, toggle row and button in a row shares one height ${open ? `in the dialog ${open} opens, on every tab` : 'on the page'}, and a toggle's switch is centred in its row (#461)`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch })
        const page = await context.newPage()
        await page.goto(`${kitBase}/kit`)
        await page.getByTestId('kit-presence').getByTestId('field-presence-flag').first().waitFor()
        expect(await page.evaluate('matchMedia("(pointer: coarse)").matches')).toBe(hasTouch)
        if (!open) {
          const onPage = await page.evaluate(controlRows)
          expect(onPage.rows).toBeGreaterThan(40)
          expect(onPage.problems).toEqual([])
          await context.close()
          return
        }
        await expect(async () => {
          await page.getByTestId(open).click()
          await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 500 })
        }).toPass()
        const tabs = await page.getByRole('dialog').first().getByRole('tab').all()
        for (const tab of tabs.length ? tabs : [undefined]) {
          if (tab) {
            await tab.click()
            await expect(tab).toHaveAttribute('aria-selected', 'true')
          }
          const inDialog = await page.evaluate(controlRows, '[role="dialog"]')
          expect(inDialog.rows).toBeGreaterThan(0)
          expect(inDialog.problems).toEqual([])
        }
        await context.close()
      })
    }
  }
}

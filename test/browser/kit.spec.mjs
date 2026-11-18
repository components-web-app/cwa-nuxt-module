import { expect, test } from '@playwright/test'

const widths = [1280, 390]
const kitBase = process.env.KIT_BASE

test.skip(!kitBase, 'Set KIT_BASE to a running playground, e.g. KIT_BASE=http://127.0.0.1:3417 pnpm run test:browser kit.spec.mjs')

async function openKit(page, width) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(`${kitBase}/kit`)
  await page.getByTestId('kit-presence').getByTestId('field-presence-flag').first().waitFor()
}

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

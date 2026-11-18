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

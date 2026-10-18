import { iris, texts } from './admin-stub-api.mjs'
import { newAdminPage, startAdminStack } from './admin-harness.mjs'

const apiPort = Number(process.env.E2E_API_PORT || 18321)
const appPort = Number(process.env.E2E_APP_PORT || 3321)
const only = process.env.E2E_ONLY

class AssertionError extends Error {}

function assert(condition, message) {
  if (!condition) {
    throw new AssertionError(message)
  }
}

async function eventually(check, message, timeout = 5000) {
  const deadline = Date.now() + timeout
  let last
  for (;;) {
    try {
      last = await check()
      if (last) {
        return last
      }
    }
    catch (error) {
      last = error
    }
    if (Date.now() > deadline) {
      throw new AssertionError(`${message}${last instanceof Error ? ` (${last.message})` : ''}`)
    }
    await new Promise(r => setTimeout(r, 100))
  }
}

async function openEditMode(page, base, path = '/') {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await eventually(() => page.getByRole('button', { name: 'Done', exact: true }).isVisible(), 'Edit mode did not start')
}

async function startClone(page) {
  await page.getByText(texts.source, { exact: true }).first().click()
  await page.locator('[id^="headlessui-popover-button"]').last().click()
  await page.getByRole('button', { name: 'Clone', exact: true }).click()
  await eventually(() => page.getByTestId('clone-mode-bar').isVisible(), 'Clone mode bar did not appear')
}

async function setNavigation(page, enabled) {
  const toggle = page.getByRole('switch', { name: 'Enable Navigation' })
  const checked = await toggle.getAttribute('aria-checked') === 'true'
  if (checked !== enabled) {
    await toggle.click()
  }
  await eventually(async () => (await toggle.getAttribute('aria-checked') === 'true') === enabled, `Enable Navigation did not turn ${enabled ? 'on' : 'off'}`)
}

function layoutLink(page, name) {
  return page.locator('header').getByRole('link', { name, exact: true })
}

function dialogWith(page, text) {
  return page.getByRole('dialog').filter({ hasText: text })
}

function isShown(dialog, text) {
  return dialog.getByText(text).first().isVisible()
}

async function dialogCount(page) {
  return page.getByRole('dialog').count()
}

async function visibleHighlights(page) {
  return page.getByTestId('clone-highlight').evaluateAll(els => els.map((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, left: r.left, width: r.width, height: r.height }
  }).filter(r => r.width > 0 && r.height > 0))
}

async function sourceBoxes(page) {
  return page.getByText(texts.source, { exact: true }).evaluateAll(els => els.map((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, left: r.left, width: r.width, height: r.height }
  }))
}

function covers(highlight, box) {
  return highlight.top <= box.top + 1
    && highlight.left <= box.left + 1
    && highlight.top + highlight.height >= box.top + box.height - 1
    && highlight.left + highlight.width >= box.left + box.width - 1
}

async function assertEveryInstanceHighlighted(page, label) {
  await eventually(async () => {
    const boxes = await sourceBoxes(page)
    const highlights = await visibleHighlights(page)
    return boxes.length > 0 && boxes.every(box => highlights.some(h => covers(h, box)))
  }, `${label}: not every instance of the source is highlighted`)
}

async function assertOnSecondPage(page, base) {
  await eventually(() => page.url() === `${base}/second`, `Expected to be on /second, at ${page.url()}`)
  await eventually(() => page.getByText(texts.pageBOther, { exact: true }).isVisible(), 'The second page\'s content did not render')
}

const scenarios = [
  ['1. with Enable Navigation on, a layout link navigates and clone mode, the bar and the highlight survive', async ({ page, base }) => {
    await openEditMode(page, base)
    await startClone(page)
    await setNavigation(page, true)
    await layoutLink(page, 'Second').click()
    await assertOnSecondPage(page, base)
    assert(await page.getByTestId('clone-mode-bar').isVisible(), 'The clone mode bar was lost on navigation')
    await assertEveryInstanceHighlighted(page, 'After navigating')
  }],
  ['2. with Enable Navigation off, a layout link click does not navigate and leads to the target dialog', async ({ page, base }) => {
    await openEditMode(page, base)
    await startClone(page)
    await layoutLink(page, 'Second').click()
    await page.waitForTimeout(800)
    assert(page.url() === `${base}/`, `Navigated to ${page.url()}`)
    const confirm = dialogWith(page, 'switch and edit the layout')
    if (await confirm.count()) {
      await confirm.getByRole('button', { name: 'Ok', exact: true }).click()
    }
    await eventually(() => isShown(dialogWith(page, 'Clone Here'), 'Clone Here'), 'The target dialog did not open')
  }],
  ['3. after navigating, a page click opens the target dialog and Add after clones the published IRI there', async ({ page, base, state }) => {
    await openEditMode(page, base)
    await startClone(page)
    await setNavigation(page, true)
    await layoutLink(page, 'Second').click()
    await assertOnSecondPage(page, base)
    await setNavigation(page, false)
    await page.getByText(texts.pageBOther, { exact: true }).click()
    const dialog = dialogWith(page, 'Clone Here')
    await eventually(() => isShown(dialog, 'Clone Here'), 'The target dialog did not open')
    await dialog.getByRole('button', { name: 'Add after', exact: true }).click()
    const post = await eventually(() => state.writes.find(w => w.method === 'POST' && w.path.endsWith('/_/component_positions')), 'No position was POSTed')
    assert(post.body.componentGroup === iris.pageBGroup, `POSTed to ${post.body.componentGroup}`)
    assert(post.body.component === iris.source, `POSTed component ${post.body.component}`)
    assert(post.body.after === '/_api/_/component_positions/b-other', `POSTed after ${post.body.after}`)
    await eventually(async () => !(await page.getByTestId('clone-mode-bar').count()), 'Clone mode did not end')
    await eventually(async () => (await page.getByText(texts.source, { exact: true }).count()) === 2, 'The new instance did not render')
  }],
  ['4. every on-screen instance of the source is highlighted, on each page', async ({ page, base }) => {
    await openEditMode(page, base)
    await startClone(page)
    await assertEveryInstanceHighlighted(page, 'On the first page')
    await setNavigation(page, true)
    await layoutLink(page, 'Second').click()
    await assertOnSecondPage(page, base)
    await assertEveryInstanceHighlighted(page, 'On the second page')
  }],
  ['5. Escape and Cancel end clone mode, turn Enable Navigation off and clear the highlight', async ({ page, base }) => {
    await openEditMode(page, base)
    for (const end of ['Escape', 'Cancel']) {
      await startClone(page)
      await setNavigation(page, true)
      if (end === 'Escape') {
        await page.keyboard.press('Escape')
      }
      else {
        await page.getByTestId('clone-mode-bar').getByRole('button', { name: 'Cancel', exact: true }).click()
      }
      await eventually(async () => !(await page.getByTestId('clone-mode-bar').count()), `${end} did not end clone mode`)
      assert(!(await page.getByRole('switch', { name: 'Enable Navigation' }).count()), `${end} left Enable Navigation showing`)
      assert((await visibleHighlights(page)).length === 0, `${end} left a highlight`)
      await layoutLink(page, 'Second').click()
      await page.waitForTimeout(800)
      assert(page.url() === `${base}/`, `${end} left navigation enabled: navigated to ${page.url()}`)
      for (let i = 0; i < 2 && await dialogCount(page); i++) {
        await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).first().click()
        await page.waitForTimeout(300)
      }
      await page.keyboard.press('Escape')
    }
  }],
  ['6. leaving edit mode during cloning, on either page, ends clone mode', async ({ page, base }) => {
    await openEditMode(page, base)
    await startClone(page)
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await eventually(async () => !(await page.getByTestId('clone-mode-bar').count()), 'Done on the first page did not end clone mode')
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await startClone(page)
    await setNavigation(page, true)
    await layoutLink(page, 'Second').click()
    await assertOnSecondPage(page, base)
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await eventually(async () => !(await page.getByTestId('clone-mode-bar').count()), 'Done on the second page did not end clone mode')
  }],
  ['7. with Enable Navigation on, a layout link click shows no dialog or confirm and navigates', async ({ page, base }) => {
    await openEditMode(page, base)
    await startClone(page)
    await setNavigation(page, true)
    await layoutLink(page, 'Third').click()
    await eventually(() => page.url() === `${base}/third`, `Expected /third, at ${page.url()}`)
    await page.waitForTimeout(800)
    assert(await dialogCount(page) === 0, `A dialog opened: ${(await page.getByRole('dialog').allInnerTexts()).join(' | ')}`)
    await eventually(() => page.getByText(texts.third, { exact: true }).isVisible(), 'The third page did not render')
  }],
  ['8. a redirect route in clone mode lands on the target page and renders its content', async ({ page, base }) => {
    await openEditMode(page, base)
    await startClone(page)
    await setNavigation(page, true)
    await layoutLink(page, 'Redirect').click()
    await assertOnSecondPage(page, base)
  }],
  ['9. in clone mode the page and layout are not blurred or hatched', async ({ page, base }) => {
    await openEditMode(page, base)
    await startClone(page)
    for (const enabled of [false, true]) {
      await setNavigation(page, enabled)
      await page.waitForTimeout(300)
      assert(!(await page.locator('#cwa-layout-page-overlay').count()), `The layout/page overlay is shown with navigation ${enabled ? 'on' : 'off'}`)
    }
  }],
  ['10. with navigation off, a layout click while page-scoped confirms first; Cancel opens nothing, Ok opens the layout\'s options', async ({ page, base }) => {
    await openEditMode(page, base)
    await startClone(page)
    const confirm = dialogWith(page, 'switch and edit the layout')
    await layoutLink(page, 'Third').click()
    await eventually(() => isShown(confirm, 'switch and edit the layout'), 'No confirm before a layout target')
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.waitForTimeout(500)
    assert(await dialogCount(page) === 0, 'Cancel still opened a dialog')
    assert(page.url() === `${base}/`, `Navigated to ${page.url()}`)
    await layoutLink(page, 'Third').click()
    await eventually(() => isShown(confirm, 'switch and edit the layout'), 'No confirm the second time')
    await confirm.getByRole('button', { name: 'Ok', exact: true }).click()
    const dialog = dialogWith(page, 'Clone Here')
    await eventually(() => isShown(dialog, 'Clone Here'), 'Ok did not open the target dialog')
    const option = dialog.getByTestId('clone-option').first()
    assert(await option.isDisabled(), 'A layout option that does not allow the source is enabled')
    assert((await dialog.innerText()).includes('does not allow HtmlContent'), 'The disabled reason is not shown')
  }],
  ['11. no highlight remains on a page that does not contain the source', async ({ page, base }) => {
    await openEditMode(page, base)
    await startClone(page)
    await setNavigation(page, true)
    await layoutLink(page, 'Third').click()
    await eventually(() => page.getByText(texts.third, { exact: true }).isVisible(), 'The third page did not render')
    await page.waitForTimeout(500)
    const count = await page.getByTestId('clone-highlight').count()
    assert(count === 0, `${count} highlight element(s) remain`)
  }],
]

async function main() {
  const stack = await startAdminStack({ apiPort, appPort })
  let failures = 0
  try {
    for (const [name, run] of scenarios) {
      if (only && !name.startsWith(`${only}.`)) {
        continue
      }
      stack.reset()
      const { context, page, errors } = await newAdminPage(stack)
      try {
        await run({ page, base: stack.appBase, state: stack.state })
        assert(errors.length === 0, `Uncaught page errors: ${errors.join(' | ')}`)
        console.log(`ok    ${name}`)
      }
      catch (error) {
        failures++
        console.log(`FAIL  ${name}\n      ${error.message.split('\n')[0]}`)
        if (process.env.E2E_SHOTS) {
          await page.screenshot({ path: `${process.env.E2E_SHOTS}/${name.split('.')[0]}.png` }).catch(() => undefined)
        }
      }
      finally {
        await context.close()
      }
    }
  }
  finally {
    await stack.stop()
  }
  if (failures) {
    console.error(`\nFAIL: ${failures} clone scenario(s) failed.`)
    process.exit(1)
  }
  console.log('\nPASS: every clone scenario passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

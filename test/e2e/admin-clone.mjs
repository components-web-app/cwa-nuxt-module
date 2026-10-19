import { mkdirSync } from 'node:fs'
import { iris, texts } from './admin-stub-api.mjs'
import { newAdminPage, startAdminStack } from './admin-harness.mjs'

const apiPort = Number(process.env.E2E_API_PORT || 18321)
const appPort = Number(process.env.E2E_APP_PORT || 3321)
const only = process.env.E2E_ONLY
const shots = process.env.E2E_SHOTS

const notFoundResource = /^Failed to load resource: the server responded with a status of 404/

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

async function openEditMode({ page, base, settle }, path = '/') {
  await page.goto(`${base}${path}`)
  await page.getByRole('button', { name: 'Edit', exact: true }).waitFor()
  await settle()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).waitFor()
}

async function select(page, text) {
  await page.getByText(text, { exact: true }).first().click()
  await page.getByTestId('component-menu').waitFor()
}

async function startClone(page) {
  await select(page, texts.source)
  await page.getByTestId('component-menu').getByTestId('button-options').click()
  await page.getByTestId('component-menu-clone').click()
  await page.getByTestId('clone-mode-bar').waitFor()
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

async function dialogTexts(page) {
  return (await page.getByRole('dialog').allInnerTexts()).join(' | ')
}

async function waitForNoDialog(page, message) {
  await eventually(async () => (await page.getByRole('dialog').count()) === 0, `${message}: ${await dialogTexts(page)}`)
}

async function visibleHighlights(page) {
  return page.getByTestId('clone-highlight').evaluateAll(els => els.map((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, left: r.left, width: r.width, height: r.height }
  }).filter(r => r.width > 0 && r.height > 0))
}

async function boxesOf(page, text) {
  return page.getByText(text, { exact: true }).evaluateAll(els => els.map((el) => {
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
    const boxes = await boxesOf(page, texts.source)
    const highlights = await visibleHighlights(page)
    return boxes.length > 0 && boxes.every(box => highlights.some(h => covers(h, box)))
  }, `${label}: not every instance of the source is highlighted`)
}

async function assertOnSecondPage({ page, base, settle }) {
  await eventually(() => page.url() === `${base}/second`, `Expected to be on /second, at ${page.url()}`)
  await page.getByText(texts.pageBOther, { exact: true }).waitFor()
  await settle()
}

async function assertCloneModeEnded(page, message) {
  await page.getByTestId('clone-mode-bar').waitFor({ state: 'detached' }).catch(() => {
    throw new AssertionError(message)
  })
}

async function sourceAbove(page, otherText) {
  const [source] = await boxesOf(page, texts.source)
  const [other] = await boxesOf(page, otherText)
  return source && other ? source.top < other.top : undefined
}

const scenarios = [
  ['1. with Enable Navigation on, a layout link navigates and clone mode, the bar and the highlight survive', async (t) => {
    const { page, state } = t
    await openEditMode(t)
    assert(state.mercureSubscriptions > 0, 'The admin never subscribed to Mercure: the API\'s Link header was not read')
    await startClone(page)
    await setNavigation(page, true)
    await layoutLink(page, 'Second').click()
    await assertOnSecondPage(t)
    assert(await page.getByTestId('clone-mode-bar').isVisible(), 'The clone mode bar was lost on navigation')
    await assertEveryInstanceHighlighted(page, 'After navigating')
  }],
  ['2. with Enable Navigation off, a layout click while page-scoped confirms, stays put, warns of the layout scope, and a Cancel there leaves the page scope', async (t) => {
    const { page, base, settle } = t
    await openEditMode(t)
    await startClone(page)
    await setNavigation(page, false)
    await layoutLink(page, 'Second').click()
    const confirm = dialogWith(page, 'switch and edit the layout')
    await confirm.getByText('switch and edit the layout').waitFor()
    assert(page.url() === `${base}/`, `Navigated to ${page.url()}`)
    await confirm.getByRole('button', { name: 'Ok', exact: true }).click()
    const dialog = dialogWith(page, 'Clone Here')
    await dialog.getByTestId('clone-scope').waitFor()
    assert((await dialog.getByTestId('clone-scope').innerText()).includes('it will appear on every page using it'), 'The layout scope warning is missing')
    assert(page.url() === `${base}/`, `Navigated to ${page.url()}`)
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await waitForNoDialog(page, 'Cancel did not close the target dialog')
    await settle()
    await page.getByText(texts.pageAOther, { exact: true }).click()
    await dialogWith(page, 'Clone Here').getByTestId('clone-option').first().waitFor()
    assert(!(await dialogWith(page, 'switch and edit').count()), 'A page click after cancelling asked to switch scope: the scope had been switched to the layout')
  }],
  ['3. after navigating, a page click opens the target dialog and Add after clones the published IRI there', async (t) => {
    const { page, state } = t
    await openEditMode(t)
    await startClone(page)
    await setNavigation(page, true)
    await layoutLink(page, 'Second').click()
    await assertOnSecondPage(t)
    await setNavigation(page, false)
    await page.getByText(texts.pageBOther, { exact: true }).click()
    const dialog = dialogWith(page, 'Clone Here')
    await dialog.getByRole('button', { name: 'Add after', exact: true }).click()
    const post = await eventually(() => state.writes.find(w => w.method === 'POST' && w.path.endsWith('/_/component_positions')), 'No position was POSTed')
    assert(post.body.componentGroup === iris.pageBGroup, `POSTed to ${post.body.componentGroup}`)
    assert(post.body.component === iris.source, `POSTed component ${post.body.component}`)
    assert(post.body.after === '/_api/_/component_positions/b-other', `POSTed after ${post.body.after}`)
    await assertCloneModeEnded(page, 'Clone mode did not end')
    await eventually(async () => (await page.getByText(texts.source, { exact: true }).count()) === 2, 'The new instance did not render')
  }],
  ['4. every on-screen instance of the source is highlighted, on each page', async (t) => {
    const { page } = t
    await openEditMode(t)
    await startClone(page)
    await assertEveryInstanceHighlighted(page, 'On the first page')
    await setNavigation(page, true)
    await layoutLink(page, 'Second').click()
    await assertOnSecondPage(t)
    await assertEveryInstanceHighlighted(page, 'On the second page')
  }],
  ['5. Escape and Cancel end clone mode, turn Enable Navigation off and clear the highlight', async (t) => {
    const { page, base } = t
    await openEditMode(t)
    for (const end of ['Escape', 'Cancel']) {
      await startClone(page)
      await setNavigation(page, true)
      if (end === 'Escape') {
        await page.keyboard.press('Escape')
      }
      else {
        await page.getByTestId('clone-mode-bar').getByRole('button', { name: 'Cancel', exact: true }).click()
      }
      await assertCloneModeEnded(page, `${end} did not end clone mode`)
      assert(!(await page.getByRole('switch', { name: 'Enable Navigation' }).count()), `${end} left Enable Navigation showing`)
      await eventually(async () => (await visibleHighlights(page)).length === 0, `${end} left a highlight`)
      await layoutLink(page, 'Second').click()
      const confirm = dialogWith(page, 'switch and edit the layout')
      await confirm.getByText('switch and edit the layout').waitFor()
      assert(page.url() === `${base}/`, `${end} left navigation enabled: navigated to ${page.url()}`)
      await confirm.getByRole('button', { name: 'Cancel', exact: true }).click()
      await waitForNoDialog(page, 'Cancel did not close the confirm')
    }
  }],
  ['6. leaving edit mode during cloning, on either page, ends clone mode', async (t) => {
    const { page } = t
    await openEditMode(t)
    await startClone(page)
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await assertCloneModeEnded(page, 'Done on the first page did not end clone mode')
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await startClone(page)
    await setNavigation(page, true)
    await layoutLink(page, 'Second').click()
    await assertOnSecondPage(t)
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await assertCloneModeEnded(page, 'Done on the second page did not end clone mode')
  }],
  ['7. with Enable Navigation on, a layout link click shows no dialog or confirm and navigates', async (t) => {
    const { page, base, settle } = t
    await openEditMode(t)
    await startClone(page)
    await setNavigation(page, true)
    await layoutLink(page, 'Third').click()
    await eventually(() => page.url() === `${base}/third`, `Expected /third, at ${page.url()}`)
    await page.getByText(texts.third, { exact: true }).waitFor()
    await settle()
    assert(await page.getByRole('dialog').count() === 0, `A dialog opened: ${await dialogTexts(page)}`)
  }],
  ['8. a redirect route in clone mode lands on the target page and renders its content', async (t) => {
    const { page } = t
    await openEditMode(t)
    await startClone(page)
    await setNavigation(page, true)
    await layoutLink(page, 'Redirect').click()
    await assertOnSecondPage(t)
  }],
  ['9. in clone mode the page and layout are not blurred or hatched', async (t) => {
    const { page, settle } = t
    await openEditMode(t)
    await page.locator('div#cwa-layout-page-overlay').waitFor({ state: 'attached' })
    await startClone(page)
    for (const enabled of [false, true]) {
      await setNavigation(page, enabled)
      await settle()
      assert(!(await page.locator('div#cwa-layout-page-overlay').count()), `The layout/page overlay is shown with navigation ${enabled ? 'on' : 'off'}`)
    }
  }],
  ['10. with navigation off, a layout click while page-scoped confirms first; Cancel opens nothing, Ok opens the layout\'s options', async (t) => {
    const { page, base, settle } = t
    await openEditMode(t)
    await startClone(page)
    await setNavigation(page, false)
    const confirm = dialogWith(page, 'switch and edit the layout')
    await layoutLink(page, 'Third').click()
    await confirm.getByText('switch and edit the layout').waitFor()
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).click()
    await waitForNoDialog(page, 'Cancel did not close the confirm')
    await settle()
    assert(await page.getByRole('dialog').count() === 0, `Cancel still opened a dialog: ${await dialogTexts(page)}`)
    assert(page.url() === `${base}/`, `Navigated to ${page.url()}`)
    await layoutLink(page, 'Third').click()
    await confirm.getByText('switch and edit the layout').waitFor()
    await confirm.getByRole('button', { name: 'Ok', exact: true }).click()
    const option = dialogWith(page, 'Clone Here').getByTestId('clone-option').first()
    await option.waitFor()
    assert(await option.isDisabled(), 'A layout option that does not allow the source is enabled')
    assert((await dialogWith(page, 'Clone Here').innerText()).includes('does not allow HtmlContent'), 'The disabled reason is not shown')
  }],
  ['11. no highlight remains on a page that does not contain the source', async (t) => {
    const { page, settle } = t
    await openEditMode(t)
    await startClone(page)
    await setNavigation(page, true)
    await layoutLink(page, 'Third').click()
    await page.getByText(texts.third, { exact: true }).waitFor()
    await settle()
    await eventually(async () => (await page.getByTestId('clone-highlight').count()) === 0, `${await page.getByTestId('clone-highlight').count()} highlight element(s) remain`)
  }],
  ['12. Move Up in the Order tab PATCHes the group order and the page keeps the new order, also after a reload', async (t) => {
    const { page, state, settle } = t
    await openEditMode(t)
    await eventually(async () => await sourceAbove(page, texts.pageAOther) === true, 'The fixture order is wrong')
    await select(page, texts.pageAOther)
    await page.getByRole('button', { name: 'Order', exact: true }).click()
    await page.getByRole('switch', { name: 'Enable reordering' }).click()
    await page.getByRole('button', { name: 'Move Up', exact: true }).click()
    const patch = await eventually(() => state.writes.find(w => w.method === 'PATCH' && w.path === `${iris.pageAGroup}/order`), 'No PATCH to the group order')
    assert(JSON.stringify(patch.body.componentPositions) === JSON.stringify(['/_api/_/component_positions/a-other', '/_api/_/component_positions/a-source']), `PATCHed ${JSON.stringify(patch.body)}`)
    await settle()
    assert(await sourceAbove(page, texts.pageAOther) === false, 'The order snapped back after the order response')
    await page.reload()
    await page.getByText(texts.pageAOther, { exact: true }).waitFor()
    await settle()
    assert(await sourceAbove(page, texts.pageAOther) === false, 'The new order did not persist')
  }],
  ['13. removing a component from one location DELETEs its position without ?published=', async (t) => {
    const { page, state, settle } = t
    await openEditMode(t)
    await select(page, texts.source)
    await page.getByRole('button', { name: 'Info', exact: true }).click()
    await page.getByTestId('component-delete').getByRole('button', { name: 'Delete', exact: true }).click()
    const dialog = dialogWith(page, 'Delete this component?')
    await dialog.getByRole('button', { name: 'Remove from this location only', exact: true }).click()
    const del = await eventually(() => state.writes.find(w => w.method === 'DELETE'), 'Nothing was DELETEd')
    assert(del.path === '/_api/_/component_positions/a-source', `DELETEd ${del.path}`)
    await eventually(async () => (await page.getByText(texts.source, { exact: true }).count()) === 0, 'The removed instance is still on the page')
    await settle()
    assert(await page.getByText(texts.pageAOther, { exact: true }).isVisible(), 'The other component went too')
    assert(state.resources.has(iris.source), 'The component itself was deleted')
  }],
  ['14. a clone whose source was deleted elsewhere ends clone mode with the source-gone message', async (t) => {
    const { page, state } = t
    await openEditMode(t)
    await startClone(page)
    await setNavigation(page, false)
    state.resources.delete(iris.source)
    await page.getByText(texts.pageAOther, { exact: true }).click()
    await dialogWith(page, 'Clone Here').getByRole('button', { name: 'Add after', exact: true }).click()
    await assertCloneModeEnded(page, 'Clone mode did not end when the API answered 404')
    await page.getByText('The component being cloned no longer exists').first().waitFor()
  }, [notFoundResource]],
  ['15. clone mode starts with Enable Navigation on, and arriving on another page turns it off so the next click places the clone', async (t) => {
    const { page } = t
    await openEditMode(t)
    await startClone(page)
    const toggle = page.getByRole('switch', { name: 'Enable Navigation' })
    assert(await toggle.getAttribute('aria-checked') === 'true', 'Clone mode started with Enable Navigation off')
    assert((await page.getByTestId('clone-mode-hint').innerText()).includes('Follow links to the page you want'), 'The bar does not say how to reach another page')
    await layoutLink(page, 'Second').click()
    await assertOnSecondPage(t)
    await eventually(async () => await toggle.getAttribute('aria-checked') === 'false', 'Enable Navigation stayed on after arriving on another page')
    assert((await page.getByTestId('clone-mode-hint').innerText()).includes('Click a component to place it'), 'The bar does not say how to place the clone')
    await page.getByText(texts.pageBOther, { exact: true }).click()
    await dialogWith(page, 'Clone Here').getByRole('button', { name: 'Add after', exact: true }).waitFor()
  }],
  ['16. a redirect in clone mode turns Enable Navigation off only once the target page is shown', async (t) => {
    const { page } = t
    await openEditMode(t)
    await startClone(page)
    await layoutLink(page, 'Redirect').click()
    await assertOnSecondPage(t)
    await eventually(async () => await page.getByRole('switch', { name: 'Enable Navigation' }).getAttribute('aria-checked') === 'false', 'Enable Navigation stayed on after the redirect')
  }],
  ['17. the highlight comes back on a page with the source after visiting one without it, on a fresh page and on one shown from the route cache', async (t) => {
    const { page, settle } = t
    await openEditMode(t)
    await startClone(page)
    for (const [name, text] of [['Third', texts.third], ['Home', texts.pageAOther], ['Third', texts.third], ['Second', texts.pageBOther], ['Third', texts.third], ['Second', texts.pageBOther]]) {
      await setNavigation(page, true)
      await layoutLink(page, name).click()
      await page.getByText(text, { exact: true }).waitFor()
      await settle()
      if (name === 'Third') {
        await eventually(async () => (await visibleHighlights(page)).length === 0, `${(await visibleHighlights(page)).length} highlight(s) on Third, which does not contain the source`)
      }
      else {
        await assertEveryInstanceHighlighted(page, `On ${name}`)
      }
    }
  }],
  ['18. a second clone session after visiting a page without the source highlights only the source', async (t) => {
    const { page, base, settle } = t
    await openEditMode(t)
    await startClone(page)
    await layoutLink(page, 'Third').click()
    await page.getByText(texts.third, { exact: true }).waitFor()
    await settle()
    await page.keyboard.press('Escape')
    await assertCloneModeEnded(page, 'Escape did not end clone mode')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.getByRole('button', { name: 'Edit', exact: true }).waitFor()
    await layoutLink(page, 'Home').click()
    await eventually(() => page.url() === `${base}/`, `Expected /, at ${page.url()}`)
    await page.getByText(texts.pageAOther, { exact: true }).waitFor()
    await settle()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await startClone(page)
    await layoutLink(page, 'Third').click()
    await page.getByText(texts.third, { exact: true }).waitFor()
    await settle()
    await eventually(async () => (await visibleHighlights(page)).length === 0, `${(await visibleHighlights(page)).length} highlight(s) on Third, which does not contain the source`)
    await setNavigation(page, true)
    await layoutLink(page, 'Second').click()
    await assertOnSecondPage(t)
    await assertEveryInstanceHighlighted(page, 'On Second in the second session')
  }],
  ['22. a link to a page already visited, shown at once from the route cache, navigates without asking to place the clone', async (t) => {
    const { page } = t
    await openEditMode(t)
    await startClone(page)
    await layoutLink(page, 'Second').click()
    await assertOnSecondPage(t)
    await setNavigation(page, true)
    await layoutLink(page, 'Home').click()
    await page.getByText(texts.pageAOther, { exact: true }).waitFor()
    await setNavigation(page, true)
    await layoutLink(page, 'Second').click()
    await assertOnSecondPage(t)
    assert(await page.getByRole('dialog').count() === 0, `A dialog opened: ${await dialogTexts(page)}`)
  }],
  ['19. Escape on the shared delete dialog cancels it and Delete works again', async (t) => {
    const { page, state } = t
    await openEditMode(t)
    await select(page, texts.source)
    await page.getByRole('button', { name: 'Info', exact: true }).click()
    const deleteButton = page.getByTestId('component-delete').getByRole('button', { name: 'Delete', exact: true })
    await deleteButton.click()
    await dialogWith(page, 'Delete this component?').getByText('Delete this component?').waitFor()
    await page.keyboard.press('Escape')
    await waitForNoDialog(page, 'Escape did not close the delete dialog')
    await eventually(() => deleteButton.isEnabled(), 'Delete stayed disabled after Escape')
    await deleteButton.click()
    await dialogWith(page, 'Delete this component?').getByText('Delete this component?').waitFor()
    assert(!state.writes.some(w => w.method === 'DELETE'), 'Escape deleted something')
  }],
  ['20. the shared delete dialog focuses Remove from this location only, so Enter removes just this one', async (t) => {
    const { page, state } = t
    await openEditMode(t)
    await select(page, texts.source)
    await page.getByRole('button', { name: 'Info', exact: true }).click()
    await page.getByTestId('component-delete').getByRole('button', { name: 'Delete', exact: true }).click()
    const dialog = dialogWith(page, 'Delete this component?')
    const here = dialog.getByRole('button', { name: 'Remove from this location only', exact: true })
    await eventually(() => here.evaluate(el => el === document.activeElement), 'Remove from this location only is not focused')
    await page.keyboard.press('Enter')
    const del = await eventually(() => state.writes.find(w => w.method === 'DELETE'), 'Enter deleted nothing')
    assert(del.path === '/_api/_/component_positions/a-source', `Enter DELETEd ${del.path}`)
    assert(state.resources.has(iris.source), 'Enter deleted the component from every location')
  }],
  ['21. cloning a layout component within the layout still says it appears on every page', async (t) => {
    const { page } = t
    await openEditMode(t)
    await layoutLink(page, 'Second').click()
    await dialogWith(page, 'switch and edit the layout').getByRole('button', { name: 'Ok', exact: true }).click()
    await page.getByTestId('component-menu').waitFor()
    await page.getByTestId('component-menu').getByTestId('button-options').click()
    await page.getByTestId('component-menu-clone').click()
    await page.getByTestId('clone-mode-bar').waitFor()
    await setNavigation(page, false)
    await layoutLink(page, 'Third').click()
    const scope = dialogWith(page, 'Clone Here').getByTestId('clone-scope')
    await scope.waitFor()
    assert((await scope.innerText()).includes('every page'), `The layout note is "${await scope.innerText()}"`)
  }],
]

function unexpectedConsoleErrors(messages, allowed) {
  return messages.filter(message => !allowed.some(pattern => pattern.test(message)))
}

async function main() {
  if (shots) {
    mkdirSync(shots, { recursive: true })
  }
  const stack = await startAdminStack({ apiPort, appPort })
  let failures = 0
  try {
    for (const [name, run, allowedConsoleErrors = []] of scenarios) {
      if (only && !only.split(',').some(n => name.startsWith(`${n}.`))) {
        continue
      }
      stack.reset()
      const { context, page, errors, consoleErrors, settle } = await newAdminPage(stack)
      try {
        await run({ page, base: stack.appBase, state: stack.state, settle })
        assert(errors.length === 0, `Uncaught page errors: ${errors.join(' | ')}`)
        const unexpected = unexpectedConsoleErrors(consoleErrors, allowedConsoleErrors)
        assert(unexpected.length === 0, `Console errors: ${unexpected.join(' | ')}`)
        console.log(`ok    ${name}`)
      }
      catch (error) {
        failures++
        console.log(`FAIL  ${name}\n      ${process.env.E2E_VERBOSE ? error.message : error.message.split('\n')[0]}`)
        if (shots) {
          await page.screenshot({ path: `${shots}/${name.split('.')[0]}.png`, fullPage: true }).catch(() => undefined)
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
    console.error(`\nFAIL: ${failures} admin browser scenario(s) failed.`)
    process.exit(1)
  }
  console.log('\nPASS: every admin browser scenario passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

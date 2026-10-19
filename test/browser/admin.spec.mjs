import { test } from './fixtures.mjs'
import { texts } from './seed.mjs'

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

async function openEditMode({ page, base, settle, seed }, path = seed.paths.home) {
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

async function startMove(page, text = texts.source) {
  await select(page, text)
  await page.getByTestId('component-menu').getByTestId('button-options').click()
  await page.getByTestId('component-menu-move').click()
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

function cloneDialog(page) {
  return page.getByRole('dialog').filter({ hasText: /Clone (Here|next to)/ })
}

function moveDialog(page) {
  return page.getByRole('dialog').filter({ hasText: /Move (Here|next to)/ })
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

async function highlightsWithOrigin(page) {
  return page.getByTestId('clone-highlight').evaluateAll(els => els.map((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, left: r.left, width: r.width, height: r.height, origin: el.dataset.origin === 'true', style: getComputedStyle(el).outlineStyle }
  }).filter(r => r.width > 0 && r.height > 0))
}

async function addSecondSourceOnHome({ api, seed }) {
  await api.create('/_/component_positions', { componentGroup: seed.iris.pageAGroup, component: seed.iris.source })
}

async function assertOnSecondPage({ page, base, settle, seed }) {
  await eventually(() => page.url() === `${base}${seed.paths.second}`, `Expected to be on ${seed.paths.second}, at ${page.url()}`)
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

test('1. with Enable Navigation on, a layout link navigates and clone mode, the bar and the highlight survive', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  assert(t.rehearsal.mercureSubscriptions > 0, 'The admin never subscribed to Mercure: the API\'s Link header was not read')
  await startClone(page)
  await setNavigation(page, true)
  await layoutLink(page, 'Second').click()
  await assertOnSecondPage(t)
  assert(await page.getByTestId('clone-mode-bar').isVisible(), 'The clone mode bar was lost on navigation')
  await assertEveryInstanceHighlighted(page, 'After navigating')
})

test('2. with Enable Navigation off, a layout click while page-scoped stays put, warns of the layout scope, and a Cancel there leaves the page scope', async ({ cwa: t }) => {
  const { page, base, settle } = t
  await openEditMode(t)
  await startClone(page)
  await setNavigation(page, false)
  await layoutLink(page, 'Second').click()
  const dialog = cloneDialog(page)
  await dialog.getByTestId('clone-scope').waitFor()
  assert((await dialog.getByTestId('clone-scope').innerText()).includes('it will appear on every page using it'), 'The layout scope warning is missing')
  assert(page.url() === `${base}${t.seed.paths.home}`, `Navigated to ${page.url()}`)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await waitForNoDialog(page, 'Cancel did not close the target dialog')
  await settle()
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await cloneDialog(page).getByTestId('clone-option').first().waitFor()
  assert(!(await dialogWith(page, 'Edit the').count()), 'A page click after cancelling asked to switch scope: the scope had been switched to the layout')
})

test('3. after navigating, a page click opens the target dialog and Add after clones the published IRI there', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
  await setNavigation(page, true)
  await layoutLink(page, 'Second').click()
  await assertOnSecondPage(t)
  await setNavigation(page, false)
  await page.getByText(texts.pageBOther, { exact: true }).click()
  const dialog = cloneDialog(page)
  await dialog.getByRole('button', { name: 'Add after', exact: true }).click()
  const post = await eventually(() => t.rehearsal.writes.find(w => w.method === 'POST' && w.path.endsWith('/_/component_positions')), 'No position was POSTed')
  assert(post.body.componentGroup === t.seed.iris.pageBGroup, `POSTed to ${post.body.componentGroup}`)
  assert(post.body.component === t.seed.iris.source, `POSTed component ${post.body.component}`)
  assert(post.body.after === t.seed.positions.bOther, `POSTed after ${post.body.after}`)
  await assertCloneModeEnded(page, 'Clone mode did not end')
  await eventually(async () => (await page.getByText(texts.source, { exact: true }).count()) === 2, 'The new instance did not render')
})

test('4. every on-screen instance of the source is highlighted, on each page', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
  await assertEveryInstanceHighlighted(page, 'On the first page')
  await setNavigation(page, true)
  await layoutLink(page, 'Second').click()
  await assertOnSecondPage(t)
  await assertEveryInstanceHighlighted(page, 'On the second page')
})

test('5. Escape and Cancel end clone mode, turn Enable Navigation off and clear the highlight', async ({ cwa: t }) => {
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
    assert(page.url() === `${base}${t.seed.paths.home}`, `${end} left navigation enabled: navigated to ${page.url()}`)
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).click()
    await waitForNoDialog(page, 'Cancel did not close the confirm')
  }
})

test('6. leaving edit mode during cloning, on either page, ends clone mode', async ({ cwa: t }) => {
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
})

test('7. with Enable Navigation on, a layout link click shows no dialog or confirm and navigates', async ({ cwa: t }) => {
  const { page, base, settle } = t
  await openEditMode(t)
  await startClone(page)
  await setNavigation(page, true)
  await layoutLink(page, 'Third').click()
  await eventually(() => page.url() === `${base}${t.seed.paths.third}`, `Expected /third, at ${page.url()}`)
  await page.getByText(texts.third, { exact: true }).waitFor()
  await settle()
  assert(await page.getByRole('dialog').count() === 0, `A dialog opened: ${await dialogTexts(page)}`)
})

test('8. a redirect route in clone mode lands on the target page and renders its content', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
  await setNavigation(page, true)
  await layoutLink(page, 'Redirect').click()
  await assertOnSecondPage(t)
})

test('9. in clone mode the page and layout are not blurred or hatched', async ({ cwa: t }) => {
  const { page, settle } = t
  await openEditMode(t)
  await page.locator('div#cwa-layout-page-overlay').waitFor({ state: 'attached' })
  await startClone(page)
  for (const enabled of [false, true]) {
    await setNavigation(page, enabled)
    await settle()
    assert(!(await page.locator('div#cwa-layout-page-overlay').count()), `The layout/page overlay is shown with navigation ${enabled ? 'on' : 'off'}`)
  }
})

test('10. with navigation off, a layout target where nothing can be placed asks nothing first and says why once, by the type\'s display name', async ({ cwa: t }) => {
  const { page, base } = t
  await openEditMode(t)
  await startClone(page)
  await setNavigation(page, false)
  await layoutLink(page, 'Third').click()
  const dialog = cloneDialog(page)
  await dialog.getByTestId('clone-option').first().waitFor()
  assert(!(await dialogWith(page, 'Edit the shared layout?').count()), 'It asked to edit the layout although nothing could be placed there')
  for (const option of await dialog.getByTestId('clone-option').all()) {
    assert(await option.isDisabled(), 'A layout option that does not allow the source is enabled')
  }
  const reasons = await dialog.getByTestId('clone-reasons').innerText()
  assert(reasons === 'This group does not allow Body Text', `The reason is "${reasons}"`)
  const text = await dialog.innerText()
  assert(text.split('does not allow').length === 2, `The reason is repeated: ${text}`)
  assert(page.url() === `${base}${t.seed.paths.home}`, `Navigated to ${page.url()}`)
})

test('11. no highlight remains on a page that does not contain the source', async ({ cwa: t }) => {
  const { page, settle } = t
  await openEditMode(t)
  await startClone(page)
  await setNavigation(page, true)
  await layoutLink(page, 'Third').click()
  await page.getByText(texts.third, { exact: true }).waitFor()
  await settle()
  await eventually(async () => (await page.getByTestId('clone-highlight').count()) === 0, `${await page.getByTestId('clone-highlight').count()} highlight element(s) remain`)
})

test('12. Move Up in the Order tab PATCHes the group order and the page keeps the new order, also after a reload', async ({ cwa: t }) => {
  const { page, settle } = t
  await openEditMode(t)
  await eventually(async () => await sourceAbove(page, texts.pageAOther) === true, 'The fixture order is wrong')
  await select(page, texts.pageAOther)
  await page.getByRole('button', { name: 'Order', exact: true }).click()
  await page.getByRole('switch', { name: 'Enable reordering' }).click()
  await page.getByRole('button', { name: 'Move Up', exact: true }).click()
  const patch = await eventually(() => t.rehearsal.writes.find(w => w.method === 'PATCH' && w.path === `${t.seed.iris.pageAGroup}/order`), 'No PATCH to the group order')
  assert(JSON.stringify(patch.body.componentPositions) === JSON.stringify([t.seed.positions.aOther, t.seed.positions.aSource]), `PATCHed ${JSON.stringify(patch.body)}`)
  await settle()
  assert(await sourceAbove(page, texts.pageAOther) === false, 'The order snapped back after the order response')
  await page.reload()
  await page.getByText(texts.pageAOther, { exact: true }).waitFor()
  await settle()
  assert(await sourceAbove(page, texts.pageAOther) === false, 'The new order did not persist')
})

test('13. removing a component from one location DELETEs its position without ?published=', async ({ cwa: t }) => {
  const { page, settle } = t
  await openEditMode(t)
  await select(page, texts.source)
  await page.getByRole('button', { name: 'Info', exact: true }).click()
  await page.getByTestId('component-delete').getByRole('button', { name: 'Delete Live', exact: true }).click()
  const dialog = dialogWith(page, 'Delete this component?')
  await dialog.getByRole('button', { name: 'Remove from this location only', exact: true }).click()
  const del = await eventually(() => t.rehearsal.writes.find(w => w.method === 'DELETE'), 'Nothing was DELETEd')
  assert(del.path === t.seed.positions.aSource, `DELETEd ${del.path}`)
  await eventually(async () => (await page.getByText(texts.source, { exact: true }).count()) === 0, 'The removed instance is still on the page')
  await settle()
  assert(await page.getByText(texts.pageAOther, { exact: true }).isVisible(), 'The other component went too')
  assert(await t.api.status(t.seed.iris.source) === 200, 'The component itself was deleted')
})

test('14. a clone whose source was deleted elsewhere ends clone mode with the source-gone message', async ({ cwa: t }) => {
  test.fail(true, 'The API answers POST /_/component_positions with a deleted component as 400 "Item not found for IRI", and the module only treats 404 as source-gone (#411)')
  const { page } = t
  t.allowConsoleErrors(notFoundResource)
  await openEditMode(t)
  await startClone(page)
  await setNavigation(page, false)
  await t.api.remove(t.seed.iris.source)
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await cloneDialog(page).getByRole('button', { name: 'Add after', exact: true }).click()
  await assertCloneModeEnded(page, 'Clone mode did not end when the API answered 404')
  await page.getByText('The component being cloned no longer exists').first().waitFor()
})

test('15. clone mode starts with Enable Navigation on, and arriving on another page turns it off so the next click places the clone', async ({ cwa: t }) => {
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
  await cloneDialog(page).getByRole('button', { name: 'Add after', exact: true }).waitFor()
})

test('16. a redirect in clone mode turns Enable Navigation off only once the target page is shown', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
  await layoutLink(page, 'Redirect').click()
  await assertOnSecondPage(t)
  await eventually(async () => await page.getByRole('switch', { name: 'Enable Navigation' }).getAttribute('aria-checked') === 'false', 'Enable Navigation stayed on after the redirect')
})

test('17. the highlight comes back on a page with the source after visiting one without it, on a fresh page and on one shown from the route cache', async ({ cwa: t }) => {
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
})

test('18. a second clone session after visiting a page without the source highlights only the source', async ({ cwa: t }) => {
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
  await eventually(() => page.url() === `${base}${t.seed.paths.home}`, `Expected /, at ${page.url()}`)
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
})

test('22. a link to a page already visited, shown at once from the route cache, navigates without asking to place the clone', async ({ cwa: t }) => {
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
})

test('23. Move within a group PATCHes the clicked position after its new neighbour, and the new order survives a reload', async ({ cwa: t }) => {
  const { page, settle } = t
  await openEditMode(t)
  await eventually(async () => await sourceAbove(page, texts.pageAOther) === true, 'The fixture order is wrong')
  await startMove(page)
  assert((await page.getByTestId('clone-mode-bar').innerText()).includes('Moving:'), 'The bar does not say Moving')
  await setNavigation(page, false)
  await page.getByText(texts.pageAOther, { exact: true }).click()
  const dialog = moveDialog(page)
  await dialog.getByRole('button', { name: 'Add after', exact: true }).click()
  const patch = await eventually(() => t.rehearsal.writes.find(w => w.method === 'PATCH' && w.path === t.seed.positions.aSource), 'The position was not PATCHed')
  assert(JSON.stringify(patch.body) === JSON.stringify({ componentGroup: t.seed.iris.pageAGroup, after: t.seed.positions.aOther }), `PATCHed ${JSON.stringify(patch.body)}`)
  assert(!t.rehearsal.writes.some(w => w.method === 'POST' || w.method === 'DELETE'), 'A move created or deleted something')
  await assertCloneModeEnded(page, 'Move mode did not end')
  await settle()
  assert(await sourceAbove(page, texts.pageAOther) === false, 'The page did not show the new order')
  await page.reload()
  await page.getByText(texts.pageAOther, { exact: true }).waitFor()
  await settle()
  assert(await sourceAbove(page, texts.pageAOther) === false, 'The new order did not persist')
})

test('24. Move to another page relocates only the clicked instance: it leaves Home, arrives on Third, and Second keeps its own', async ({ cwa: t }) => {
  const { page, base, settle } = t
  await openEditMode(t)
  await startMove(page)
  await layoutLink(page, 'Third').click()
  await page.getByText(texts.third, { exact: true }).waitFor()
  await eventually(async () => await page.getByRole('switch', { name: 'Enable Navigation' }).getAttribute('aria-checked') === 'false', 'Enable Navigation stayed on after arriving')
  await page.getByText(texts.third, { exact: true }).click()
  await moveDialog(page).getByRole('button', { name: 'Add after', exact: true }).click()
  const patch = await eventually(() => t.rehearsal.writes.find(w => w.method === 'PATCH' && w.path === t.seed.positions.aSource), 'The position was not PATCHed')
  assert(JSON.stringify(patch.body) === JSON.stringify({ componentGroup: t.seed.iris.pageCGroup, after: t.seed.positions.cThird }), `PATCHed ${JSON.stringify(patch.body)}`)
  await assertCloneModeEnded(page, 'Move mode did not end')
  await eventually(async () => (await page.getByText(texts.source, { exact: true }).count()) === 1, 'The moved component is not on Third')
  await settle()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await layoutLink(page, 'Home').click()
  await eventually(() => page.url() === `${base}${t.seed.paths.home}`, `Expected /, at ${page.url()}`)
  await page.getByText(texts.pageAOther, { exact: true }).waitFor()
  await settle()
  assert(await page.getByText(texts.source, { exact: true }).count() === 0, 'The moved component is still on Home')
  await layoutLink(page, 'Second').click()
  await assertOnSecondPage(t)
  assert(await page.getByText(texts.source, { exact: true }).count() === 1, 'The other instance on Second was moved too')
})

test('25. Move is not offered next to its own position, with the reason', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startMove(page)
  await setNavigation(page, false)
  await page.getByText(texts.source, { exact: true }).click()
  const dialog = moveDialog(page)
  for (const name of ['Add before', 'Add after']) {
    assert(await dialog.getByRole('button', { name, exact: true }).isDisabled(), `${name} is enabled next to the position being moved`)
  }
  assert((await dialog.innerText()).includes('This is where it already is'), 'The reason is not shown')
})

test('26. moving a layout component into the page warns that it will leave every other page', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await layoutLink(page, 'Second').click()
  await dialogWith(page, 'switch and edit the layout').getByRole('button', { name: 'Ok', exact: true }).click()
  await page.getByTestId('component-menu').waitFor()
  await page.getByTestId('component-menu').getByTestId('button-options').click()
  await page.getByTestId('component-menu-move').click()
  await page.getByTestId('clone-mode-bar').waitFor()
  await setNavigation(page, false)
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await dialogWith(page, 'Edit the page?').getByRole('button', { name: 'Edit page', exact: true }).click()
  const note = moveDialog(page).getByTestId('move-leaves-layout')
  await note.waitFor()
  assert((await note.innerText()).includes('no longer appear on other pages'), `The note is "${await note.innerText()}"`)
})

test('27. a move whose position was deleted elsewhere ends move mode with the source-gone message', async ({ cwa: t }) => {
  const { page } = t
  t.allowConsoleErrors(notFoundResource)
  await openEditMode(t)
  await startMove(page)
  await setNavigation(page, false)
  await t.api.remove(t.seed.positions.aSource)
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await moveDialog(page).getByRole('button', { name: 'Add after', exact: true }).click()
  await assertCloneModeEnded(page, 'Move mode did not end when the API answered 404')
  await page.getByText('The component being moved no longer exists').first().waitFor()
})

test('28. after a clone the new instance is selected and its outline flashes, and the flash then goes', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
  await setNavigation(page, false)
  await page.getByText(texts.pageAOther, { exact: true }).click()
  const dialog = cloneDialog(page)
  await dialog.getByRole('button', { name: 'Add after', exact: true }).click()
  await eventually(() => t.rehearsal.writes.find(w => w.method === 'POST' && w.path.endsWith('/_/component_positions')), 'No position was POSTed')
  await assertCloneModeEnded(page, 'Clone mode did not end')
  await eventually(async () => (await page.getByText(texts.source, { exact: true }).count()) === 2, 'The new instance did not render')
  await eventually(async () => {
    const [, placed] = await boxesOf(page, texts.source)
    const flashes = await page.getByTestId('clone-placed').evaluateAll(els => els.map((el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, left: r.left, width: r.width, height: r.height }
    }))
    return flashes.length === 1 && covers(flashes[0], placed)
  }, 'The new instance did not flash')
  await page.getByTestId('component-menu').waitFor()
  await eventually(async () => {
    const [first, placed] = await boxesOf(page, texts.source)
    const focus = await page.locator('canvas.cwa\\:z-manager-focus + div').evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, left: r.left, width: r.width, height: r.height }
    })
    return covers(focus, placed) && !covers(focus, first)
  }, 'The new instance is not the one selected')
  await eventually(async () => (await page.getByTestId('clone-placed').count()) === 0, 'The flash did not go', 4000)
})

test('29. after a move the moved instance is selected and its outline flashes', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startMove(page)
  await setNavigation(page, false)
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await moveDialog(page).getByRole('button', { name: 'Add after', exact: true }).click()
  await eventually(() => t.rehearsal.writes.find(w => w.method === 'PATCH' && w.path === t.seed.positions.aSource), 'The position was not PATCHed')
  await assertCloneModeEnded(page, 'Move mode did not end')
  await eventually(async () => {
    const [moved] = await boxesOf(page, texts.source)
    const flashes = await page.getByTestId('clone-placed').evaluateAll(els => els.map((el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, left: r.left, width: r.width, height: r.height }
    }))
    return flashes.length === 1 && moved && covers(flashes[0], moved) && await sourceAbove(page, texts.pageAOther) === false
  }, 'The moved instance did not flash where it landed')
  await page.getByTestId('component-menu').waitFor()
})

test('30. in clone and move mode the instance started from is outlined solid and the other instance dashed', async ({ cwa: t }) => {
  const { page, settle } = t
  await addSecondSourceOnHome(t)
  await openEditMode(t)
  await eventually(async () => (await page.getByText(texts.source, { exact: true }).count()) === 2, 'The second instance did not render')
  for (const start of [startClone, startMove]) {
    await start(page)
    await settle()
    await eventually(async () => {
      const [from, other] = await boxesOf(page, texts.source)
      const highlights = await highlightsWithOrigin(page)
      const origin = highlights.filter(h => h.origin)
      const rest = highlights.filter(h => !h.origin)
      return highlights.length === 2
        && origin.length === 1 && covers(origin[0], from) && origin[0].style === 'solid'
        && rest.length === 1 && covers(rest[0], other) && rest[0].style === 'dashed'
    }, `${start.name}: the instance started from is not marked apart from the other: ${JSON.stringify(await highlightsWithOrigin(page))}`)
    await page.keyboard.press('Escape')
    await assertCloneModeEnded(page, 'Escape did not end the mode')
  }
})

test('31. switching scope in clone mode asks "Edit the page?" or "Edit the shared layout?" with Edit page or Edit layout and Cancel', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await layoutLink(page, 'Second').click()
  await dialogWith(page, 'switch and edit the layout').getByRole('button', { name: 'Ok', exact: true }).click()
  await page.getByTestId('component-menu').waitFor()
  await page.getByTestId('component-menu').getByTestId('button-options').click()
  await page.getByTestId('component-menu-clone').click()
  await page.getByTestId('clone-mode-bar').waitFor()
  await setNavigation(page, false)
  await page.getByText(texts.pageAOther, { exact: true }).click()
  const toPage = dialogWith(page, 'Edit the page?')
  await toPage.getByRole('button', { name: 'Edit page', exact: true }).waitFor()
  assert(await toPage.getByRole('button', { name: 'Cancel', exact: true }).isVisible(), 'The page confirm has no Cancel')
  await toPage.getByRole('button', { name: 'Edit page', exact: true }).click()
  await cloneDialog(page).getByRole('button', { name: 'Add after', exact: true }).click()
  await eventually(() => t.rehearsal.writes.find(w => w.method === 'POST' && w.path.endsWith('/_/component_positions')), 'No position was POSTed')
  await assertCloneModeEnded(page, 'Clone mode did not end')
  await page.getByTestId('component-menu').waitFor()
  await page.getByTestId('component-menu').getByTestId('button-options').click()
  await page.getByTestId('component-menu-clone').click()
  await page.getByTestId('clone-mode-bar').waitFor()
  await setNavigation(page, false)
  await layoutLink(page, 'Third').click()
  const toLayout = dialogWith(page, 'Edit the shared layout?')
  await toLayout.getByRole('button', { name: 'Edit layout', exact: true }).waitFor()
  await toLayout.getByRole('button', { name: 'Cancel', exact: true }).click()
  await waitForNoDialog(page, 'Cancel did not close the layout confirm')
  assert(t.rehearsal.writes.filter(w => w.method === 'POST').length === 1, 'Cancel placed something')
  assert(await page.getByTestId('clone-mode-bar').isVisible(), 'Cancel ended clone mode')
})

test('32. the bar names the content as well as its type, and the dialog names the anchor', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
  const bar = await page.getByTestId('clone-mode-source').innerText()
  assert(bar === `Cloning: Body Text — “${texts.source}”`, `The bar says "${bar}"`)
  await setNavigation(page, false)
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await page.getByRole('dialog').getByText(`Clone next to “${texts.pageAOther}”`, { exact: true }).waitFor()
})

test('33. the options button is named More actions', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await select(page, texts.source)
  await page.getByTestId('component-menu').getByRole('button', { name: 'More actions', exact: true }).click()
  await page.getByTestId('component-menu-clone').waitFor()
})

test('19. Escape on the shared delete dialog cancels it and Delete works again', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await select(page, texts.source)
  await page.getByRole('button', { name: 'Info', exact: true }).click()
  const deleteButton = page.getByTestId('component-delete').getByRole('button', { name: 'Delete Live', exact: true })
  await deleteButton.click()
  await dialogWith(page, 'Delete this component?').getByText('Delete this component?').waitFor()
  await page.keyboard.press('Escape')
  await waitForNoDialog(page, 'Escape did not close the delete dialog')
  await eventually(() => deleteButton.isEnabled(), 'Delete stayed disabled after Escape')
  await deleteButton.click()
  await dialogWith(page, 'Delete this component?').getByText('Delete this component?').waitFor()
  assert(!t.rehearsal.writes.some(w => w.method === 'DELETE'), 'Escape deleted something')
})

test('20. the shared delete dialog focuses Remove from this location only, so Enter removes just this one', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await select(page, texts.source)
  await page.getByRole('button', { name: 'Info', exact: true }).click()
  await page.getByTestId('component-delete').getByRole('button', { name: 'Delete Live', exact: true }).click()
  const dialog = dialogWith(page, 'Delete this component?')
  const here = dialog.getByRole('button', { name: 'Remove from this location only', exact: true })
  await eventually(() => here.evaluate(el => el === document.activeElement), 'Remove from this location only is not focused')
  await page.keyboard.press('Enter')
  const del = await eventually(() => t.rehearsal.writes.find(w => w.method === 'DELETE'), 'Enter deleted nothing')
  assert(del.path === t.seed.positions.aSource, `Enter DELETEd ${del.path}`)
  assert(await t.api.status(t.seed.iris.source) === 200, 'Enter deleted the component from every location')
})

test('21. cloning a layout component within the layout still says it appears on every page', async ({ cwa: t }) => {
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
  const scope = cloneDialog(page).getByTestId('clone-scope')
  await scope.waitFor()
  assert((await scope.innerText()).includes('every page'), `The layout note is "${await scope.innerText()}"`)
})

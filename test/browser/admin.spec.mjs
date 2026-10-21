import { test } from './fixtures.mjs'
import { articleTexts, seedArticlePages, texts } from './seed.mjs'

const notFoundResource = /^Failed to load resource: the server responded with a status of 404/
const unknownResource = /^Failed to load resource: the server responded with a status of (400|404)/
const refusedResource = /^Failed to load resource: the server responded with a status of 422/

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

function moveWrite(t) {
  return eventually(() => t.rehearsal.writes.find(w => w.method === 'POST' && w.path.endsWith('/move')), 'No move was POSTed')
}

function assertMove(write, componentIri, body) {
  assert(write.path === `${componentIri}/move`, `POSTed the move to ${write.path}`)
  assert(JSON.stringify(write.body) === JSON.stringify(body), `POSTed ${JSON.stringify(write.body)}`)
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

function cloneMenu(page) {
  return page.getByTestId('clone-menu').filter({ hasText: /Clone (Here|next to)/ })
}

function moveMenu(page) {
  return page.getByTestId('clone-menu').filter({ hasText: /Move (Here|next to)/ })
}

async function reasonsBehind(page, menu, name) {
  await menu.getByRole('button', { name, exact: true }).click()
  const reasons = page.getByTestId('clone-option-reasons')
  await reasons.waitFor()
  return reasons.innerText()
}

async function waitForNoMenu(page, message) {
  await eventually(async () => (await page.getByTestId('clone-menu').count()) === 0, message)
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
  const menu = cloneMenu(page)
  await menu.getByTestId('clone-scope').waitFor()
  assert((await menu.getByTestId('clone-scope').innerText()).includes('it will appear on every page using it'), 'The layout scope note is missing')
  assert(page.url() === `${base}${t.seed.paths.home}`, `Navigated to ${page.url()}`)
  await page.keyboard.press('Escape')
  await waitForNoMenu(page, 'Escape did not close the placement menu')
  assert(await page.getByTestId('clone-mode-bar').isVisible(), 'Escape on the placement menu ended clone mode')
  await settle()
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await cloneMenu(page).getByTestId('clone-option').first().waitFor()
  assert(!(await cloneMenu(page).getByTestId('clone-scope').count()), 'A page target after closing the menu has a scope note: the scope had been switched to the layout')
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
  await cloneMenu(page).getByRole('button', { name: 'Add after', exact: true }).click()
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
  const menu = cloneMenu(page)
  const nothing = menu.getByTestId('clone-nothing')
  await nothing.waitFor()
  assert(await nothing.isDisabled(), 'Nothing can be placed here is enabled')
  assert(!(await menu.getByTestId('clone-option').count()), 'Options are listed although none allows the source')
  assert(!(await dialogWith(page, 'Edit the shared layout?').count()), 'It asked to edit the layout although nothing could be placed there')
  const reasons = await reasonsBehind(page, menu, 'Why nothing can be placed here')
  assert(reasons === 'This group does not allow Body Text', `The reason is "${reasons}"`)
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
  const { page } = t
  t.allowConsoleErrors(unknownResource)
  await openEditMode(t)
  await startClone(page)
  await setNavigation(page, false)
  await t.api.remove(t.seed.iris.source)
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await cloneMenu(page).getByRole('button', { name: 'Add after', exact: true }).click()
  await assertCloneModeEnded(page, 'Clone mode did not end when the API refused the deleted source')
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
  await cloneMenu(page).getByRole('button', { name: 'Add after', exact: true }).waitFor()
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

test('23. Move within a group POSTs the clicked position\'s move after its new neighbour, and the new order survives a reload', async ({ cwa: t }) => {
  const { page, settle } = t
  await openEditMode(t)
  await eventually(async () => await sourceAbove(page, texts.pageAOther) === true, 'The fixture order is wrong')
  await startMove(page)
  assert((await page.getByTestId('clone-mode-bar').innerText()).includes('Moving:'), 'The bar does not say Moving')
  await setNavigation(page, false)
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await moveMenu(page).getByRole('button', { name: 'Add after', exact: true }).click()
  assertMove(await moveWrite(t), t.seed.iris.source, { from: { componentPosition: t.seed.positions.aSource }, to: { componentGroup: t.seed.iris.pageAGroup, after: t.seed.positions.aOther } })
  assert(t.rehearsal.writes.length === 1, `A move wrote more than once: ${JSON.stringify(t.rehearsal.writes)}`)
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
  await moveMenu(page).getByRole('button', { name: 'Add after', exact: true }).click()
  assertMove(await moveWrite(t), t.seed.iris.source, { from: { componentPosition: t.seed.positions.aSource }, to: { componentGroup: t.seed.iris.pageCGroup, after: t.seed.positions.cThird } })
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
  const menu = moveMenu(page)
  const nothing = menu.getByTestId('clone-nothing')
  await nothing.waitFor()
  assert(await nothing.isDisabled(), 'Nothing can be placed here is enabled')
  assert(!(await menu.getByTestId('clone-option').count()), 'Add before or Add after is offered next to the position being moved')
  const reasons = await reasonsBehind(page, menu, 'Why nothing can be placed here')
  assert(reasons.includes('This is where it already is'), `The reason is "${reasons}"`)
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
  const note = moveMenu(page).getByTestId('move-leaves-layout')
  await note.waitFor()
  assert((await note.innerText()).includes('no longer appear on other pages'), `The note is "${await note.innerText()}"`)
  assert(!(await dialogWith(page, 'Edit the page?').count()), 'It asked to edit the page before an option was chosen')
})

test('27. a move whose position was deleted elsewhere ends move mode with the source-gone message', async ({ cwa: t }) => {
  const { page } = t
  t.allowConsoleErrors(notFoundResource, refusedResource)
  await openEditMode(t)
  await startMove(page)
  await setNavigation(page, false)
  await t.api.remove(t.seed.positions.aSource)
  await placeInMove(page, texts.pageAOther, 'Add after')
  await assertCloneModeEnded(page, 'Move mode did not end when the API refused the deleted position')
  await page.getByText('The component being moved no longer exists').first().waitFor()
})

test('28. after a clone the new instance is selected and its outline flashes, and the flash then goes', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
  await setNavigation(page, false)
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await cloneMenu(page).getByRole('button', { name: 'Add after', exact: true }).click()
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
  await placeInMove(page, texts.pageAOther, 'Add after')
  await moveWrite(t)
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
  await cloneMenu(page).getByRole('button', { name: 'Add after', exact: true }).click()
  const toPage = dialogWith(page, 'Edit the page?')
  await toPage.getByRole('button', { name: 'Edit page', exact: true }).waitFor()
  assert(await toPage.getByRole('button', { name: 'Cancel', exact: true }).isVisible(), 'The page confirm has no Cancel')
  assert(!t.rehearsal.writes.some(w => w.method === 'POST'), 'It placed before the scope was confirmed')
  await toPage.getByRole('button', { name: 'Edit page', exact: true }).click()
  await eventually(() => t.rehearsal.writes.find(w => w.method === 'POST' && w.path.endsWith('/_/component_positions')), 'No position was POSTed')
  await assertCloneModeEnded(page, 'Clone mode did not end')
  await page.getByTestId('component-menu').waitFor()
  await page.getByTestId('component-menu').getByTestId('button-options').click()
  await page.getByTestId('component-menu-clone').click()
  await page.getByTestId('clone-mode-bar').waitFor()
  await setNavigation(page, false)
  await layoutLink(page, 'Third').click()
  await cloneMenu(page).getByRole('button', { name: 'Add after', exact: true }).click()
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
  await cloneMenu(page).getByText(`Clone next to “${texts.pageAOther}”`, { exact: true }).waitFor()
})

test('33. the options button is named More actions', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await select(page, texts.source)
  await page.getByTestId('component-menu').getByRole('button', { name: 'More actions', exact: true }).click()
  await page.getByTestId('component-menu-clone').waitFor()
})

async function arriveForPlacing({ page, settle }, link, text) {
  await layoutLink(page, link).click()
  await page.getByText(text, { exact: true }).waitFor()
  await eventually(async () => await page.getByRole('switch', { name: 'Enable Navigation' }).getAttribute('aria-checked') === 'false', `Enable Navigation stayed on after arriving on ${link}`)
  await settle()
}

async function placeInMove(page, text, option) {
  for (let attempt = 1; ; attempt++) {
    await page.getByText(text, { exact: true }).click()
    const menu = moveMenu(page)
    const opened = await menu.locator('[data-testid="clone-option"], [data-testid="clone-nothing"]').first().waitFor({ timeout: 4000 }).then(() => true, () => false)
    if (!opened && attempt < 3) {
      continue
    }
    const button = menu.getByRole('button', { name: option, exact: true })
    if (await button.count() || attempt === 3) {
      await button.click()
      return
    }
    await page.keyboard.press('Escape')
    await waitForNoMenu(page, 'Escape did not close the move menu')
  }
}

async function moveMenuOffers(page, text) {
  await select(page, text)
  await page.getByTestId('component-menu').getByTestId('button-options').click()
  await page.getByText('Add After', { exact: true }).waitFor()
  return await page.getByTestId('component-menu-move').count() > 0
}

test('36. Move out of a page-data slot into another page\'s group sends the slot\'s page data, and the slot then shows the template\'s fallback', async ({ cwa: t }) => {
  const { page, settle } = t
  const articles = await seedArticlePages(t.api, t.rehearsal.token, t.seed)
  await openEditMode(t, articles.paths.articleA)
  await startMove(page, articleTexts.slotA)
  await arriveForPlacing(t, 'Home', texts.pageAOther)
  await placeInMove(page, texts.pageAOther, 'Add after')
  assertMove(await moveWrite(t), articles.iris.slotA, { from: { pageData: articles.iris.articleA, property: 'htmlContent' }, to: { componentGroup: t.seed.iris.pageAGroup, after: t.seed.positions.aOther } })
  await assertCloneModeEnded(page, 'Move mode did not end')
  await page.getByText(articleTexts.slotA, { exact: true }).waitFor()
  await settle()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await layoutLink(page, 'Article A').click()
  await page.getByText(articleTexts.fallback, { exact: true }).waitFor()
  await settle()
  assert(await page.getByText(articleTexts.slotA, { exact: true }).count() === 0, 'The slot still shows the moved component')
})

test('37. Move from a group into an empty page-data slot sends the position and the slot\'s page data, and leaves the group', async ({ cwa: t }) => {
  const { page, settle } = t
  const articles = await seedArticlePages(t.api, t.rehearsal.token, t.seed)
  await openEditMode(t)
  await startMove(page, texts.pageAOther)
  await arriveForPlacing(t, 'Article B', articleTexts.fallback)
  await placeInMove(page, articleTexts.fallback, 'Use here')
  assertMove(await moveWrite(t), t.seed.iris.pageAOther, { from: { componentPosition: t.seed.positions.aOther }, to: { pageData: articles.iris.articleB, property: 'htmlContent' } })
  await assertCloneModeEnded(page, 'Move mode did not end')
  await page.getByText(texts.pageAOther, { exact: true }).waitFor()
  await settle()
  assert(await page.getByText(articleTexts.fallback, { exact: true }).count() === 0, 'The slot still shows the template\'s fallback')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await layoutLink(page, 'Home').click()
  await page.getByText(texts.source, { exact: true }).waitFor()
  await settle()
  assert(await page.getByText(texts.pageAOther, { exact: true }).count() === 0, 'The moved component is still on Home')
})

test('38. Move from a page-data slot into the same slot on another page-data page sends both page data, and swaps what each page shows', async ({ cwa: t }) => {
  const { page, settle } = t
  const articles = await seedArticlePages(t.api, t.rehearsal.token, t.seed)
  await openEditMode(t, articles.paths.articleA)
  await startMove(page, articleTexts.slotA)
  await arriveForPlacing(t, 'Article B', articleTexts.fallback)
  await placeInMove(page, articleTexts.fallback, 'Use here')
  assertMove(await moveWrite(t), articles.iris.slotA, { from: { pageData: articles.iris.articleA, property: 'htmlContent' }, to: { pageData: articles.iris.articleB, property: 'htmlContent' } })
  await assertCloneModeEnded(page, 'Move mode did not end')
  await page.getByText(articleTexts.slotA, { exact: true }).waitFor()
  await settle()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await layoutLink(page, 'Article A').click()
  await page.getByText(articleTexts.fallback, { exact: true }).waitFor()
  await settle()
  assert(await page.getByText(articleTexts.slotA, { exact: true }).count() === 0, 'Article A still shows the moved component')
})

test('39. in move mode an occupied page-data slot is disabled with the reason, and the slot moved from is where it already is', async ({ cwa: t }) => {
  const { page } = t
  await seedArticlePages(t.api, t.rehearsal.token, t.seed)
  await openEditMode(t)
  await startMove(page, texts.pageAOther)
  await arriveForPlacing(t, 'Article A', articleTexts.slotA)
  await page.getByText(articleTexts.slotA, { exact: true }).click()
  const occupied = moveMenu(page)
  await occupied.getByTestId('clone-nothing').waitFor()
  assert(!(await occupied.getByTestId('clone-option').count()), 'Use here is offered on an occupied slot')
  const occupiedReasons = await reasonsBehind(page, occupied, 'Why nothing can be placed here')
  assert(occupiedReasons.includes('This field already holds Body Text: a move cannot replace it'), `The reason is "${occupiedReasons}"`)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await waitForNoMenu(page, 'Escape did not close the move menu')
  await page.keyboard.press('Escape')
  await assertCloneModeEnded(page, 'Escape did not end move mode')

  await startMove(page, articleTexts.slotA)
  await setNavigation(page, false)
  await page.getByText(articleTexts.slotA, { exact: true }).click()
  const itself = moveMenu(page)
  await itself.getByTestId('clone-nothing').waitFor()
  assert(!(await itself.getByTestId('clone-option').count()), 'Use here is offered on the slot moved from')
  const itselfReasons = await reasonsBehind(page, itself, 'Why nothing can be placed here')
  assert(itselfReasons.includes('This is where it already is'), `The reason is "${itselfReasons}"`)
  assert(t.rehearsal.writes.length === 0, `Something was written: ${JSON.stringify(t.rehearsal.writes)}`)
})

test('40. Move is never offered from a page-data slot showing the template\'s fallback', async ({ cwa: t }) => {
  const { page } = t
  const articles = await seedArticlePages(t.api, t.rehearsal.token, t.seed)
  await openEditMode(t, articles.paths.articleB)
  assert(!await moveMenuOffers(page, articleTexts.fallback), 'Move is offered from a slot showing the template\'s fallback')
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
  const scope = cloneMenu(page).getByTestId('clone-scope')
  await scope.waitFor()
  assert((await scope.innerText()).includes('every page'), `The layout note is "${await scope.innerText()}"`)
})

test('34. a shared component shows how many places it is used in beside the publish button; an unshared one shows nothing', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await select(page, texts.source)
  const badge = page.getByTestId('component-usage-badge')
  await badge.waitFor()
  assert(await badge.innerText() === 'Shared · 2 places', `The badge says "${await badge.innerText()}"`)
  await eventually(async () => {
    const [badgeBox, menuBox] = [await badge.boundingBox(), await page.getByTestId('component-menu').getByTestId('button-options').boundingBox()]
    return badgeBox && menuBox && badgeBox.x + badgeBox.width <= menuBox.x && Math.abs((badgeBox.y + badgeBox.height / 2) - (menuBox.y + menuBox.height / 2)) < 8
  }, 'The badge is not just left of the publish button, in the same row')
  await select(page, texts.pageAOther)
  await eventually(async () => (await badge.count()) === 0, 'An unshared component shows the badge')
})

test('35. selecting a component outlines its other copies on the page, not the selected one', async ({ cwa: t }) => {
  const { page, settle } = t
  await openEditMode(t)
  await startClone(page)
  await setNavigation(page, false)
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await cloneMenu(page).getByRole('button', { name: 'Add after', exact: true }).click()
  await assertCloneModeEnded(page, 'Clone mode did not end')
  await eventually(async () => (await page.getByText(texts.source, { exact: true }).count()) === 2, 'The clone did not render')
  await settle()
  await page.getByText(texts.source, { exact: true }).first().click()
  await page.getByTestId('component-menu').waitFor()
  const outlineBoxes = async () => page.getByTestId('shared-instance-outline').evaluateAll(els => els.map((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, left: r.left, width: r.width, height: r.height }
  }))
  await eventually(async () => {
    const [selected, copy] = await boxesOf(page, texts.source)
    const found = await outlineBoxes()
    return found.length === 1 && covers(found[0], copy) && !covers(found[0], selected)
  }, `The outlines are ${JSON.stringify(await outlineBoxes())}`)
  await page.keyboard.press('Escape')
  await select(page, texts.pageAOther)
  await eventually(async () => (await page.getByTestId('shared-instance-outline').count()) === 0, 'An outline stayed after selecting an unshared component')
})

test.describe('the list of places behind the shared badge', () => {
  test('41. the shared badge lists the pages a component is on, marking this page and linking the other', async ({ cwa: t }) => {
    const { page } = t
    await openEditMode(t)
    await select(page, texts.source)
    await page.getByTestId('component-usage-badge').click()
    const list = page.getByTestId('component-usage-list')
    await list.waitFor()
    const rows = await list.getByTestId('component-usage-location').allInnerTexts()
    assert(rows.length === 2, `The list has ${rows.length} rows: ${JSON.stringify(rows)}`)
    assert(rows[0].includes('E2E page a') && rows[0].includes('This page'), `The first row is "${rows[0]}"`)
    assert(rows[1].includes('E2E page b') && !rows[1].includes('This page'), `The second row is "${rows[1]}"`)
    assert(await list.getByRole('link', { name: 'E2E page a', exact: true }).count() === 0, 'This page is linked')
    assert(await list.getByRole('link', { name: 'E2E page b', exact: true }).count() === 1, 'The other page is not linked')
    assert(await list.getByTestId('component-usage-more').count() === 0, 'The list says there are more places')
  })

  test('42. following a page in the shared list while editing goes there and stays in edit mode', async ({ cwa: t }) => {
    const { page } = t
    await openEditMode(t)
    await select(page, texts.source)
    await page.getByTestId('component-usage-badge').click()
    await page.getByTestId('component-usage-list').getByRole('link', { name: 'E2E page b', exact: true }).click()
    await assertOnSecondPage(t)
    assert(!page.url().includes('cwa_force'), `The address kept cwa_force: ${page.url()}`)
    assert(await page.getByTestId('component-usage-list').count() === 0, 'The list stayed open')
    await page.getByRole('button', { name: 'Done', exact: true }).waitFor()
  })
})

test('43. a click on a target in clone mode outlines it in blue dashed at once and opens the menu at the click point, and Escape or a click outside closes the menu and keeps clone mode on', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
  await setNavigation(page, false)
  const box = await page.getByText(texts.pageAOther, { exact: true }).boundingBox()
  const point = { x: box.x + 10, y: box.y + box.height / 2 }
  await page.mouse.click(point.x, point.y)
  const menu = cloneMenu(page)
  await menu.getByTestId('clone-option').first().waitFor()
  const outline = page.getByTestId('clone-target')
  const drawn = await outline.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    return { top: r.top, left: r.left, width: r.width, height: r.height, style: style.outlineStyle, color: style.outlineColor }
  })
  const [targetBox] = await boxesOf(page, texts.pageAOther)
  assert(covers(drawn, targetBox), `The target outline ${JSON.stringify(drawn)} does not cover the target ${JSON.stringify(targetBox)}`)
  assert(drawn.style === 'dashed' && drawn.color === 'rgb(37, 99, 235)', `The target outline is ${drawn.style} ${drawn.color}, not blue dashed`)
  const sourceColors = await page.getByTestId('clone-highlight').evaluateAll(els => els.map(el => getComputedStyle(el).outlineColor))
  assert(sourceColors.length > 0 && !sourceColors.includes(drawn.color), `The target outline has the source outline's colour: ${JSON.stringify(sourceColors)}`)
  const menuBox = await menu.boundingBox()
  assert(Math.abs(menuBox.x - point.x) <= 2 && menuBox.y >= point.y && menuBox.y - point.y <= 8, `The menu is at ${JSON.stringify(menuBox)}, not at the click point ${JSON.stringify(point)}`)

  await page.keyboard.press('Escape')
  await waitForNoMenu(page, 'Escape did not close the menu')
  await eventually(async () => (await outline.count()) === 0, 'The target outline stayed after the menu closed')
  assert(await page.getByTestId('clone-mode-bar').isVisible(), 'Escape on the menu ended clone mode')

  await page.mouse.click(point.x, point.y)
  await menu.getByTestId('clone-option').first().waitFor()
  await page.getByTestId('clone-mode-source').click()
  await waitForNoMenu(page, 'A click outside did not close the menu')
  assert(await page.getByTestId('clone-mode-bar').isVisible(), 'A click outside the menu ended clone mode')
  assert(t.rehearsal.writes.length === 0, `Something was written: ${JSON.stringify(t.rehearsal.writes)}`)
})

test('44. where nothing can be placed the menu has one disabled row whose ⓘ shows the reasons on click, and Escape closes the reasons before the menu', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startMove(page)
  await setNavigation(page, false)
  await page.getByText(texts.source, { exact: true }).click()
  const menu = moveMenu(page)
  const nothing = menu.getByTestId('clone-nothing')
  await nothing.waitFor()
  assert(await nothing.innerText() === 'Nothing can be placed here', `The row says "${await nothing.innerText()}"`)
  assert(await nothing.isDisabled(), 'Nothing can be placed here is enabled')
  assert(!(await menu.innerText()).includes('This is where it already is'), 'The reason shows in the menu before its ⓘ is clicked')
  const reasons = await reasonsBehind(page, menu, 'Why nothing can be placed here')
  assert(reasons.includes('This is where it already is'), `The reasons are "${reasons}"`)

  await page.keyboard.press('Escape')
  await eventually(async () => (await page.getByTestId('clone-option-reasons').count()) === 0, 'Escape did not close the reasons')
  assert(await menu.isVisible(), 'Escape on the reasons closed the menu too')
  await page.keyboard.press('Escape')
  await waitForNoMenu(page, 'The second Escape did not close the menu')
  assert(await page.getByTestId('clone-mode-bar').isVisible(), 'Escape on the menu ended move mode')
})

test('45. near the right edge of the window the placement menu shifts left to stay on screen', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
  await setNavigation(page, false)
  const target = page.getByText(texts.pageAOther, { exact: true })
  const box = await target.boundingBox()
  const viewport = page.viewportSize()
  const point = { x: box.x + box.width - 10, y: box.y + box.height / 2 }
  assert(point.x + 220 > viewport.width, `The click at ${point.x} is not near the right edge of the ${viewport.width}px window`)
  assert(await target.evaluate((el, { x, y }) => el.contains(document.elementFromPoint(x, y)), point), 'The target is covered at the click point')
  await page.mouse.click(point.x, point.y)
  const menu = cloneMenu(page)
  await menu.getByTestId('clone-option').first().waitFor()
  await eventually(async () => {
    const m = await menu.boundingBox()
    return m && m.x >= 0 && m.x + m.width <= viewport.width && m.x < point.x && m.y >= point.y
  }, `The menu ${JSON.stringify(await menu.boundingBox())} is not on screen below ${JSON.stringify(point)} in the ${JSON.stringify(viewport)} window`)
})

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function presenceSent(t, matches, message) {
  return eventually(() => t.rehearsal.realtime.find(body => body?.event === 'presence' && matches(body.data ?? {})), `${message}: ${JSON.stringify(t.rehearsal.realtime)}`)
}

function peerPresence(t, { key, name, page, state = 'viewing' }) {
  return {
    '@type': 'CwaRealtimeEvent',
    'v': 1,
    'clientId': `00000000-0000-4000-8000-${key.padStart(12, '0')}`,
    'user': { id: `/users/e2e-${t.rehearsal.token}-${key}`, name },
    'event': 'presence',
    'iri': null,
    'data': { v: 1, page, state },
    'sentAt': '2001-01-01T00:00:00.000000+00:00',
    'expiresAt': '2001-01-01T00:00:45.000000+00:00',
  }
}

function managerPanel(page) {
  return page.locator('.cwa\\:z-manager')
}

function managerInput(page) {
  return managerPanel(page).locator('input')
}

async function selectLayoutLink(t, name) {
  const { page } = t
  await layoutLink(page, name).click()
  await dialogWith(page, 'switch and edit the layout').getByRole('button', { name: 'Ok', exact: true }).click()
  await page.getByTestId('component-menu').waitFor()
  return presenceSent(t, data => data.state === 'selected' && !!data.component, 'No selected presence was sent for the link')
}

test.describe('presence', () => {
  test('46. an admin\'s tab announces it is viewing the page on load, and the component and position it selects', async ({ cwa: t }) => {
    const { page, seed } = t
    await openEditMode(t)
    const viewing = await presenceSent(t, data => data.state === 'viewing' && data.page === seed.iris.pageA, 'No viewing presence was sent for the page')
    assert(uuid.test(viewing.clientId), `The client id is "${viewing.clientId}"`)
    await select(page, texts.pageAOther)
    const selected = await presenceSent(t, data => data.state === 'selected', 'No selected presence was sent')
    assert(selected.clientId === viewing.clientId, `The client id changed from ${viewing.clientId} to ${selected.clientId}`)
    assert(JSON.stringify(selected.data) === JSON.stringify({ v: 1, page: seed.iris.pageA, state: 'selected', component: seed.iris.pageAOther, componentPosition: seed.positions.aOther }), `Sent ${JSON.stringify(selected.data)}`)
  })

  test('47. another admin on this page shows as initials in the header, one on another page as +1 elsewhere, the list names both with their page, and left removes them', async ({ cwa: t }) => {
    const { page, base, seed, settle } = t
    await page.goto(`${base}${seed.paths.home}`)
    await page.getByRole('button', { name: 'Edit', exact: true }).waitFor()
    await settle()
    await layoutLink(page, 'Second').click()
    await assertOnSecondPage(t)
    await layoutLink(page, 'Home').click()
    await eventually(() => page.url() === `${base}${seed.paths.home}`, `Expected to be on ${seed.paths.home}, at ${page.url()}`)
    await page.getByText(texts.pageAOther, { exact: true }).waitFor()
    await settle()
    await presenceSent(t, data => data.page === seed.iris.pageA, 'No presence was sent for the page')
    await eventually(() => t.rehearsal.mercureSubscriptions > 0, 'Mercure was never subscribed to')

    const here = peerPresence(t, { key: '1', name: 'Pat Peer', page: seed.iris.pageA })
    const elsewhere = peerPresence(t, { key: '2', name: 'Robin Remote', page: seed.iris.pageB })
    t.publish(here)
    t.publish(elsewhere)

    const indicator = page.getByTestId('presence-indicator')
    await eventually(async () => (await indicator.getByTestId('presence-avatar').allInnerTexts()).join(',') === 'PP', `The avatars are ${JSON.stringify(await indicator.getByTestId('presence-avatar').allInnerTexts())}`)
    const others = indicator.getByTestId('presence-elsewhere')
    await eventually(async () => (await others.allInnerTexts()).join() === '+1 elsewhere', `The header says ${JSON.stringify(await others.allInnerTexts())}`)

    await indicator.click()
    const rows = page.getByTestId('presence-list').getByTestId('presence-row')
    await eventually(async () => (await rows.count()) === 2, `The list has ${await rows.count()} rows`)
    const [first, second] = await rows.allInnerTexts()
    assert(first.includes('Pat Peer') && first.includes('This page') && first.includes('Viewing'), `The first row is "${first}"`)
    assert(second.includes('Robin Remote') && second.includes('E2E page b') && !second.includes('This page'), `The second row is "${second}"`)
    await page.keyboard.press('Escape')
    await page.getByTestId('presence-list').waitFor({ state: 'detached' })

    t.publish({ ...here, data: { v: 1, page: seed.iris.pageA, state: 'left' } })
    await eventually(async () => (await indicator.getByTestId('presence-avatar').count()) === 0, 'The avatar stayed after its tab left')
    const remaining = await others.allInnerTexts()
    assert(remaining.join() === '+1 elsewhere', `The header says ${JSON.stringify(remaining)} after the tab on this page left`)
    t.publish({ ...elsewhere, data: { v: 1, page: seed.iris.pageB, state: 'left' } })
    await eventually(async () => (await indicator.count()) === 0, 'The indicator stayed after every other tab left')
  })

  test('48. focusing a field in the manager panel sends editing with the component and the field, and blurring it sends selected again', async ({ cwa: t }) => {
    const { page, seed } = t
    await openEditMode(t)
    const selected = await selectLayoutLink(t, 'Third')
    await page.getByRole('button', { name: 'Label', exact: true }).click()
    const input = managerInput(page)
    await input.focus()
    const editing = await presenceSent(t, data => data.state === 'editing', 'No editing presence was sent on focus')
    assert(JSON.stringify(editing.data) === JSON.stringify({ v: 1, page: seed.iris.pageA, state: 'editing', component: selected.data.component, componentPosition: selected.data.componentPosition, field: 'label' }), `Sent ${JSON.stringify(editing.data)}`)
    const sentBeforeBlur = t.rehearsal.realtime.length
    await input.evaluate(el => el.blur())
    const back = await eventually(() => t.rehearsal.realtime.slice(sentBeforeBlur).find(body => body?.event === 'presence'), 'Nothing was sent on blur')
    assert(JSON.stringify(back.data) === JSON.stringify(selected.data), `Sent ${JSON.stringify(back.data)} on blur`)
    assert(t.rehearsal.writes.length === 0, `Something was written: ${JSON.stringify(t.rehearsal.writes)}`)
  })

  test('49. another admin editing a component on this page outlines it with their name flag, and left removes the outline', async ({ cwa: t }) => {
    const { page, seed } = t
    await openEditMode(t)
    await presenceSent(t, data => data.page === seed.iris.pageA, 'No presence was sent for the page')
    await eventually(() => t.rehearsal.mercureSubscriptions > 0, 'Mercure was never subscribed to')
    const peer = peerPresence(t, { key: '1', name: 'Pat Peer', page: seed.iris.pageA })
    t.publish({ ...peer, data: { v: 1, page: seed.iris.pageA, state: 'editing', component: seed.iris.pageAOther, componentPosition: seed.positions.aOther } })
    const outline = page.getByTestId('peer-outline')
    await eventually(async () => (await outline.count()) === 1, `There are ${await outline.count()} outlines`)
    const drawnBox = () => outline.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, left: r.left, width: r.width, height: r.height }
    })
    await eventually(async () => covers(await drawnBox(), (await boxesOf(page, texts.pageAOther))[0]), 'The outline never covered the component')
    const flag = outline.getByTestId('peer-flag')
    assert(await flag.innerText() === 'Pat Peer is editing', `The flag says "${await flag.innerText()}"`)
    assert(await flag.getAttribute('data-faded') === null, 'The flag is faded as soon as it appears')
    t.publish({ ...peer, data: { v: 1, page: seed.iris.pageA, state: 'left' } })
    await eventually(async () => (await outline.count()) === 0, 'The outline stayed after its tab left')
  })

  test('50. another admin focused on the same field shows their name flag on the kit input, and it goes when they leave', async ({ cwa: t }) => {
    const { page, seed } = t
    await openEditMode(t)
    const selected = await selectLayoutLink(t, 'Third')
    await page.getByRole('button', { name: 'Label', exact: true }).click()
    await managerInput(page).waitFor()
    await eventually(() => t.rehearsal.mercureSubscriptions > 0, 'Mercure was never subscribed to')
    const peer = peerPresence(t, { key: '1', name: 'Pat Peer', page: seed.iris.pageA })
    const { component, componentPosition } = selected.data
    t.publish({ ...peer, data: { v: 1, page: seed.iris.pageA, state: 'editing', component, componentPosition, field: 'label' } })
    const flag = managerPanel(page).getByTestId('field-presence-flag')
    await eventually(async () => (await flag.count()) === 1, 'The field flag did not show')
    assert(await flag.innerText() === 'Pat Peer', `The field flag says "${await flag.innerText()}"`)
    const [fieldBox, inputBox] = [await managerPanel(page).getByTestId('field-presence').boundingBox(), await managerInput(page).boundingBox()]
    assert(covers({ top: fieldBox.y, left: fieldBox.x, width: fieldBox.width, height: fieldBox.height }, { top: inputBox.y, left: inputBox.x, width: inputBox.width, height: inputBox.height }), `The field outline ${JSON.stringify(fieldBox)} does not cover the input ${JSON.stringify(inputBox)}`)
    t.publish({ ...peer, data: { v: 1, page: seed.iris.pageA, state: 'left' } })
    await eventually(async () => (await flag.count()) === 0, 'The field flag stayed after its tab left')
  })
})

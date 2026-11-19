import * as Y from 'yjs'
import { expect, test } from './fixtures.mjs'
import { apiPrefix } from './api-client.mjs'
import { mercurePath } from './rehearsal.mjs'
import { articleTexts, collectionTexts, seedArticlePages, seedCollection, texts } from './seed.mjs'
import { controlRows } from './control-rows.mjs'

const notFoundResource = /^Failed to load resource: the server responded with a status of 404/
const unknownResource = /^Failed to load resource: the server responded with a status of (400|404)/
const refusedResource = /^Failed to load resource: the server responded with a status of 422/

class AssertionError extends Error {}

async function settledBox(locator) {
  await locator.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
  return locator.boundingBox()
}

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

async function select(page, text, { editable = true } = {}) {
  await page.getByText(text, { exact: true }).first().click()
  await page.getByTestId('component-menu').waitFor()
  editable && await page.locator('.ProseMirror[contenteditable=true]').filter({ hasText: text }).first().waitFor()
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

function layoutLink(page, name) {
  return page.locator('header').getByRole('link', { name, exact: true })
}

function linkMenu(page) {
  return page.getByTestId('link-menu')
}

async function editLayoutLink(page, name) {
  await layoutLink(page, name).click()
  await dialogWith(page, 'Edit the shared layout?').getByRole('button', { name: 'Edit layout', exact: true }).click()
  await linkMenu(page).getByTestId('link-menu-edit').click()
}

async function visit(page, name) {
  await layoutLink(page, name).click()
  await page.getByTestId('clone-visit').click()
}

function dialogs(page) {
  return page.locator('[role="dialog"], [role="alertdialog"]')
}

function dialogWith(page, text) {
  return dialogs(page).filter({ hasText: text })
}

function cloneMenu(page) {
  return page.getByTestId('clone-menu').filter({ hasText: /Clone (Here|next to)/ })
}

function moveMenu(page) {
  return page.getByTestId('clone-menu').filter({ hasText: /Move (Here|next to)/ })
}

async function reasonsBehind(page, menu, name) {
  await menu.getByRole('menuitem', { name, exact: true }).click()
  const reasons = page.getByTestId('menu-item-reasons')
  await reasons.waitFor()
  return reasons.innerText()
}

async function waitForNoMenu(page, message) {
  await eventually(async () => (await page.getByTestId('clone-menu').count()) === 0, message)
}

async function dialogTexts(page) {
  return (await dialogs(page).allInnerTexts()).join(' | ')
}

async function waitForNoDialog(page, message) {
  await eventually(async () => (await dialogs(page).count()) === 0, `${message}: ${await dialogTexts(page)}`)
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
    return { top: r.top, left: r.left, width: r.width, height: r.height, origin: el.dataset.origin === 'true', style: getComputedStyle(el).outlineStyle, thickness: Number.parseFloat(getComputedStyle(el).outlineWidth) }
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

test('1. Visit on a layout link navigates, and clone mode, the bar and the highlight survive', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  assert(t.rehearsal.mercureSubscriptions > 0, 'The admin never subscribed to Mercure: the API\'s Link header was not read')
  await startClone(page)
  await visit(page, 'Second')
  await assertOnSecondPage(t)
  assert(await page.getByTestId('clone-mode-bar').isVisible(), 'The clone mode bar was lost on navigation')
  await assertEveryInstanceHighlighted(page, 'After navigating')
})

test('2. a layout link clicked while page-scoped stays put, warns of the layout scope, and a Cancel there leaves the page scope', async ({ cwa: t }) => {
  const { page, base, settle } = t
  await openEditMode(t)
  await startClone(page)
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
  await visit(page, 'Second')
  await assertOnSecondPage(t)
  await page.getByText(texts.pageBOther, { exact: true }).click()
  await cloneMenu(page).getByRole('menuitem', { name: 'Add after', exact: true }).click()
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
  await visit(page, 'Second')
  await assertOnSecondPage(t)
  await assertEveryInstanceHighlighted(page, 'On the second page')
})

test('5. Escape and Cancel end clone mode and clear the highlight, and a layout link clicked then asks to edit the layout before any menu, without navigating', async ({ cwa: t }) => {
  const { page, base, settle } = t
  await openEditMode(t)
  for (const end of ['Escape', 'Cancel']) {
    await startClone(page)
    if (end === 'Escape') {
      await page.keyboard.press('Escape')
    }
    else {
      await page.getByTestId('clone-mode-bar').getByRole('button', { name: 'Cancel', exact: true }).click()
    }
    await assertCloneModeEnded(page, `${end} did not end clone mode`)
    await eventually(async () => (await visibleHighlights(page)).length === 0, `${end} left a highlight`)
    await layoutLink(page, 'Second').click()
    const confirm = dialogWith(page, 'Edit the shared layout?')
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).waitFor()
    assert(page.url() === `${base}${t.seed.paths.home}`, `${end} left the link navigating: at ${page.url()}`)
    assert(!(await linkMenu(page).count()), `After ${end} the link menu opened before the scope was confirmed`)
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).click()
    await waitForNoDialog(page, 'Cancel did not close the confirm')
    await settle()
    assert(!(await linkMenu(page).count()), 'Cancel on the scope confirm opened the link menu')
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
  await visit(page, 'Second')
  await assertOnSecondPage(t)
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await assertCloneModeEnded(page, 'Done on the second page did not end clone mode')
})

test('7. Visit on a layout link shows no dialog or confirm and navigates', async ({ cwa: t }) => {
  const { page, base, settle } = t
  await openEditMode(t)
  await startClone(page)
  await visit(page, 'Third')
  await eventually(() => page.url() === `${base}${t.seed.paths.third}`, `Expected /third, at ${page.url()}`)
  await page.getByText(texts.third, { exact: true }).waitFor()
  await settle()
  assert(await dialogs(page).count() === 0, `A dialog opened: ${await dialogTexts(page)}`)
})

test('8. a redirect route in clone mode lands on the target page and renders its content', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
  await visit(page, 'Redirect')
  await assertOnSecondPage(t)
})

test('9. in clone mode the page and layout are not blurred or hatched', async ({ cwa: t }) => {
  const { page, settle } = t
  await openEditMode(t)
  await page.locator('div#cwa-layout-page-overlay').waitFor({ state: 'attached' })
  await startClone(page)
  await settle()
  assert(!(await page.locator('div#cwa-layout-page-overlay').count()), 'The layout/page overlay is shown in clone mode')
})

test('10. a layout target where nothing can be placed asks nothing first and says why once, by the type\'s display name', async ({ cwa: t }) => {
  const { page, base } = t
  await openEditMode(t)
  await startClone(page)
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
  await visit(page, 'Third')
  await page.getByText(texts.third, { exact: true }).waitFor()
  await settle()
  await eventually(async () => (await page.getByTestId('clone-highlight').count()) === 0, `${await page.getByTestId('clone-highlight').count()} highlight element(s) remain`)
})

test('12. Move up in the Order tab PATCHes the group order and the page keeps the new order, also after a reload', async ({ cwa: t }) => {
  const { page, settle } = t
  await openEditMode(t)
  await eventually(async () => await sourceAbove(page, texts.pageAOther) === true, 'The fixture order is wrong')
  await select(page, texts.pageAOther)
  await page.getByRole('tab', { name: 'Order', exact: true }).click()
  assert(await page.getByRole('switch', { name: 'Enable reordering' }).count() === 0, 'A component\'s Order tab offers Enable reordering')
  let release
  const held = new Promise((resolve) => {
    release = resolve
  })
  await page.route(url => url.pathname.endsWith('/order'), async (route) => {
    route.request().method() === 'PATCH' && await held
    await route.continue()
  })
  await page.getByRole('button', { name: 'Move up', exact: true }).click()
  await page.locator('div#cwa-layout-page-overlay').waitFor({ state: 'attached' })
  const line = page.getByTestId('manager-saving-line')
  await line.locator('> *').first().waitFor({ state: 'attached' })
  await page.addStyleTag({ content: '[data-testid="manager-saving-line"], [data-testid="manager-saving-line"] * { pointer-events: auto !important; }' })
  const { onTop, track } = await line.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    return { onTop: !!hit && element.contains(hit), track: getComputedStyle(element.firstElementChild).backgroundColor }
  })
  release()
  assert(onTop, 'Something covers the saving line above the manager bar while the order is saving')
  assert(!['transparent', 'rgba(0, 0, 0, 0)'].includes(track), `The saving line is not painted (${track})`)
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
  await page.getByRole('tab', { name: 'Info', exact: true }).click()
  await page.getByTestId('component-delete').getByRole('button', { name: 'Delete', exact: true }).click()
  const dialog = dialogWith(page, 'Delete this component?')
  await dialog.getByRole('button', { name: 'Remove from here', exact: true }).click()
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
  await t.api.remove(t.seed.iris.source)
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await cloneMenu(page).getByRole('menuitem', { name: 'Add after', exact: true }).click()
  await assertCloneModeEnded(page, 'Clone mode did not end when the API refused the deleted source')
  await page.getByText('The component being cloned no longer exists').first().waitFor()
})

test('15. clone mode has no Enable Navigation: its bar says to click where it should go, and after Visit the next click on the new page places the clone', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
  assert(!(await page.getByRole('switch', { name: 'Enable Navigation' }).count()), 'Clone mode shows Enable Navigation')
  assert(await page.getByTestId('clone-mode-hint').innerText() === 'Click where it should go', `The bar says "${await page.getByTestId('clone-mode-hint').innerText()}"`)
  await visit(page, 'Second')
  await assertOnSecondPage(t)
  await page.getByText(texts.pageBOther, { exact: true }).click()
  await cloneMenu(page).getByRole('menuitem', { name: 'Add after', exact: true }).waitFor()
})

test('16. Visit on a redirect link in clone mode ends on the target page, which is placeable at once', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
  await visit(page, 'Redirect')
  await assertOnSecondPage(t)
  await page.getByText(texts.pageBOther, { exact: true }).click()
  await cloneMenu(page).getByRole('menuitem', { name: 'Add after', exact: true }).waitFor()
})

test('17. the highlight comes back on a page with the source after visiting one without it, on a fresh page and on one shown from the route cache', async ({ cwa: t }) => {
  const { page, settle } = t
  await openEditMode(t)
  await startClone(page)
  for (const [name, text] of [['Third', texts.third], ['Home', texts.pageAOther], ['Third', texts.third], ['Second', texts.pageBOther], ['Third', texts.third], ['Second', texts.pageBOther]]) {
    await visit(page, name)
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
  await visit(page, 'Third')
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
  await visit(page, 'Third')
  await page.getByText(texts.third, { exact: true }).waitFor()
  await settle()
  await eventually(async () => (await visibleHighlights(page)).length === 0, `${(await visibleHighlights(page)).length} highlight(s) on Third, which does not contain the source`)
  await visit(page, 'Second')
  await assertOnSecondPage(t)
  await assertEveryInstanceHighlighted(page, 'On Second in the second session')
})

test('22. Visit to a page already visited, shown at once from the route cache, navigates without asking to place the clone', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
  await visit(page, 'Second')
  await assertOnSecondPage(t)
  await visit(page, 'Home')
  await page.getByText(texts.pageAOther, { exact: true }).waitFor()
  await visit(page, 'Second')
  await assertOnSecondPage(t)
  assert(await dialogs(page).count() === 0, `A dialog opened: ${await dialogTexts(page)}`)
})

test('23. Move within a group POSTs the clicked position\'s move after its new neighbour, and the new order survives a reload', async ({ cwa: t }) => {
  const { page, settle } = t
  await openEditMode(t)
  await eventually(async () => await sourceAbove(page, texts.pageAOther) === true, 'The fixture order is wrong')
  await startMove(page)
  assert((await page.getByTestId('clone-mode-bar').innerText()).includes('Moving:'), 'The bar does not say Moving')
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await moveMenu(page).getByRole('menuitem', { name: 'Add after', exact: true }).click()
  assertMove(await moveWrite(t), t.seed.iris.source, { from: { componentPosition: t.seed.positions.aSource }, to: { componentGroup: t.seed.iris.pageAGroup, after: t.seed.positions.aOther } })
  assert(contentWrites(t).length === 1, `A move wrote more than once: ${JSON.stringify(contentWrites(t))}`)
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
  await visit(page, 'Third')
  await page.getByText(texts.third, { exact: true }).waitFor()
  await page.getByText(texts.third, { exact: true }).click()
  await moveMenu(page).getByRole('menuitem', { name: 'Add after', exact: true }).click()
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
  await editLayoutLink(page, 'Second')
  await page.getByTestId('component-menu').waitFor()
  await page.getByTestId('component-menu').getByTestId('button-options').click()
  await page.getByTestId('component-menu-move').click()
  await page.getByTestId('clone-mode-bar').waitFor()
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
  await t.api.remove(t.seed.positions.aSource)
  await placeInMove(page, texts.pageAOther, 'Add after')
  await assertCloneModeEnded(page, 'Move mode did not end when the API refused the deleted position')
  await page.getByText('The component being moved no longer exists').first().waitFor()
})

test('28. after a clone the new instance is selected and its outline flashes, and the flash then goes', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await cloneMenu(page).getByRole('menuitem', { name: 'Add after', exact: true }).click()
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

test('30. in clone and move mode the instance started from has a thicker outline than the other instance', async ({ cwa: t }) => {
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
        && rest.length === 1 && covers(rest[0], other) && rest[0].style === 'solid' && origin[0].thickness > rest[0].thickness
    }, `${start.name}: the instance started from is not marked apart from the other: ${JSON.stringify(await highlightsWithOrigin(page))}`)
    await page.keyboard.press('Escape')
    await assertCloneModeEnded(page, 'Escape did not end the mode')
  }
})

test('31. switching scope in clone mode asks "Edit the page?" or "Edit the shared layout?" with Edit page or Edit layout and Cancel', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await editLayoutLink(page, 'Second')
  await page.getByTestId('component-menu').waitFor()
  await page.getByTestId('component-menu').getByTestId('button-options').click()
  await page.getByTestId('component-menu-clone').click()
  await page.getByTestId('clone-mode-bar').waitFor()
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await cloneMenu(page).getByRole('menuitem', { name: 'Add after', exact: true }).click()
  const toPage = dialogWith(page, 'Edit the page?')
  await toPage.getByRole('button', { name: 'Edit page', exact: true }).waitFor()
  assert(await toPage.getByRole('button', { name: 'Cancel', exact: true }).isVisible(), 'The page confirm has no Cancel')
  assert(!contentWrites(t).some(w => w.method === 'POST'), 'It placed before the scope was confirmed')
  await toPage.getByRole('button', { name: 'Edit page', exact: true }).click()
  await eventually(() => t.rehearsal.writes.find(w => w.method === 'POST' && w.path.endsWith('/_/component_positions')), 'No position was POSTed')
  await assertCloneModeEnded(page, 'Clone mode did not end')
  await page.getByTestId('component-menu').waitFor()
  await page.getByTestId('component-menu').getByTestId('button-options').click()
  await page.getByTestId('component-menu-clone').click()
  await page.getByTestId('clone-mode-bar').waitFor()
  await layoutLink(page, 'Third').click()
  await cloneMenu(page).getByRole('menuitem', { name: 'Add after', exact: true }).click()
  const toLayout = dialogWith(page, 'Edit the shared layout?')
  await toLayout.getByRole('button', { name: 'Edit layout', exact: true }).waitFor()
  await toLayout.getByRole('button', { name: 'Cancel', exact: true }).click()
  await waitForNoDialog(page, 'Cancel did not close the layout confirm')
  assert(contentWrites(t).filter(w => w.method === 'POST').length === 1, 'Cancel placed something')
  assert(await page.getByTestId('clone-mode-bar').isVisible(), 'Cancel ended clone mode')
})

test('32. the bar names the content as well as its type, and the dialog names the anchor', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
  const bar = await page.getByTestId('clone-mode-source').innerText()
  assert(bar === `Cloning: Body Text — “${texts.source}”`, `The bar says "${bar}"`)
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
  await visit(page, link)
  await page.getByText(text, { exact: true }).waitFor()
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
    const button = menu.getByRole('menuitem', { name: option, exact: true })
    if (await button.count() || attempt === 3) {
      await button.click()
      return
    }
    await page.keyboard.press('Escape')
    await waitForNoMenu(page, 'Escape did not close the move menu')
  }
}

async function moveMenuOffers(page, text, options) {
  await select(page, text, options)
  await page.getByTestId('component-menu').getByTestId('button-options').click()
  await page.getByText('Add after', { exact: true }).waitFor()
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
  await page.getByText(articleTexts.slotA, { exact: true }).click()
  const itself = moveMenu(page)
  await itself.getByTestId('clone-nothing').waitFor()
  assert(!(await itself.getByTestId('clone-option').count()), 'Use here is offered on the slot moved from')
  const itselfReasons = await reasonsBehind(page, itself, 'Why nothing can be placed here')
  assert(itselfReasons.includes('This is where it already is'), `The reason is "${itselfReasons}"`)
  assert(contentWrites(t).length === 0, `Something was written: ${JSON.stringify(contentWrites(t))}`)
})

test('40. Move is never offered from a page-data slot showing the template\'s fallback', async ({ cwa: t }) => {
  const { page } = t
  const articles = await seedArticlePages(t.api, t.rehearsal.token, t.seed)
  await openEditMode(t, articles.paths.articleB)
  assert(!await moveMenuOffers(page, articleTexts.fallback, { editable: false }), 'Move is offered from a slot showing the template\'s fallback')
})

test('19. Escape on the shared delete dialog cancels it and Delete works again', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await select(page, texts.source)
  await page.getByRole('tab', { name: 'Info', exact: true }).click()
  const deleteButton = page.getByTestId('component-delete').getByRole('button', { name: 'Delete', exact: true })
  await deleteButton.click()
  await dialogWith(page, 'Delete this component?').getByText('Delete this component?').waitFor()
  await page.keyboard.press('Escape')
  await waitForNoDialog(page, 'Escape did not close the delete dialog')
  await eventually(() => deleteButton.isEnabled(), 'Delete stayed disabled after Escape')
  await deleteButton.click()
  await dialogWith(page, 'Delete this component?').getByText('Delete this component?').waitFor()
  assert(!t.rehearsal.writes.some(w => w.method === 'DELETE'), 'Escape deleted something')
})

test('20. the shared delete dialog focuses Remove from here, so Enter removes just this one', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await select(page, texts.source)
  await page.getByRole('tab', { name: 'Info', exact: true }).click()
  await page.getByTestId('component-delete').getByRole('button', { name: 'Delete', exact: true }).click()
  const dialog = dialogWith(page, 'Delete this component?')
  const here = dialog.getByRole('button', { name: 'Remove from here', exact: true })
  await eventually(() => here.evaluate(el => el === document.activeElement), 'Remove from here is not focused')
  await page.keyboard.press('Enter')
  const del = await eventually(() => t.rehearsal.writes.find(w => w.method === 'DELETE'), 'Enter deleted nothing')
  assert(del.path === t.seed.positions.aSource, `Enter DELETEd ${del.path}`)
  assert(await t.api.status(t.seed.iris.source) === 200, 'Enter deleted the component from every location')
})

test('21. cloning a layout component within the layout still says it appears on every page', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await editLayoutLink(page, 'Second')
  await page.getByTestId('component-menu').waitFor()
  await page.getByTestId('component-menu').getByTestId('button-options').click()
  await page.getByTestId('component-menu-clone').click()
  await page.getByTestId('clone-mode-bar').waitFor()
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
  await page.getByText(texts.pageAOther, { exact: true }).click()
  await cloneMenu(page).getByRole('menuitem', { name: 'Add after', exact: true }).click()
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

test('43. a click on a target in clone mode outlines it in solid blue at once and opens the menu at the click point, and Escape or a click outside closes the menu and keeps clone mode on', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
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
  assert(drawn.style === 'solid' && drawn.color === 'rgb(37, 99, 235)', `The target outline is ${drawn.style} ${drawn.color}, not solid blue`)
  const sourceColors = await page.getByTestId('clone-highlight').evaluateAll(els => els.map(el => getComputedStyle(el).outlineColor))
  assert(sourceColors.length > 0 && !sourceColors.includes(drawn.color), `The target outline has the source outline's colour: ${JSON.stringify(sourceColors)}`)
  const menuBox = await settledBox(menu)
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
  assert(contentWrites(t).length === 0, `Something was written: ${JSON.stringify(contentWrites(t))}`)
})

test('44. where nothing can be placed the menu has one disabled row whose ⓘ shows the reasons on click, and Escape closes the reasons before the menu', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startMove(page)
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
  await eventually(async () => (await page.getByTestId('menu-item-reasons').count()) === 0, 'Escape did not close the reasons')
  assert(await menu.isVisible(), 'Escape on the reasons closed the menu too')
  await page.keyboard.press('Escape')
  await waitForNoMenu(page, 'The second Escape did not close the menu')
  assert(await page.getByTestId('clone-mode-bar').isVisible(), 'Escape on the menu ended move mode')
})

test('45. near the right edge of the window the placement menu shifts left to stay on screen', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)
  await startClone(page)
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
    const m = await settledBox(menu)
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
  await editLayoutLink(page, name)
  await page.getByTestId('component-menu').waitFor()
  return presenceSent(t, data => data.state === 'selected' && !!data.component, 'No selected presence was sent for the link')
}

test.describe('presence', () => {
  test('46. an admin\'s tab announces it is viewing the page on load, and the component and position it selects', async ({ cwa: t }) => {
    const { page, seed } = t
    await openEditMode(t)
    const viewing = await presenceSent(t, data => data.state === 'viewing' && data.page === seed.iris.pageA, 'No viewing presence was sent for the page')
    assert(uuid.test(viewing.clientId), `The client id is "${viewing.clientId}"`)
    assert(typeof viewing.data.device === 'string' && viewing.data.device.length > 0, `The device is ${JSON.stringify(viewing.data.device)}`)
    await select(page, texts.pageAOther)
    const selected = await presenceSent(t, data => data.component === seed.iris.pageAOther, 'No presence was sent for the selected component')
    assert(selected.clientId === viewing.clientId, `The client id changed from ${viewing.clientId} to ${selected.clientId}`)
    assert(JSON.stringify(selected.data) === JSON.stringify({ v: 1, page: seed.iris.pageA, state: 'editing', device: viewing.data.device, component: seed.iris.pageAOther, componentPosition: seed.positions.aOther, field: 'html' }), `Sent ${JSON.stringify(selected.data)}`)
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
    await page.getByRole('tab', { name: 'Label', exact: true }).click()
    const input = managerInput(page)
    await input.focus()
    const editing = await presenceSent(t, data => data.state === 'editing', 'No editing presence was sent on focus')
    assert(JSON.stringify(editing.data) === JSON.stringify({ v: 1, page: seed.iris.pageA, state: 'editing', device: selected.data.device, component: selected.data.component, componentPosition: selected.data.componentPosition, field: 'label' }), `Sent ${JSON.stringify(editing.data)}`)
    const sentBeforeBlur = t.rehearsal.realtime.length
    await input.evaluate(el => el.blur())
    const back = await eventually(() => t.rehearsal.realtime.slice(sentBeforeBlur).find(body => body?.event === 'presence'), 'Nothing was sent on blur')
    assert(JSON.stringify(back.data) === JSON.stringify(selected.data), `Sent ${JSON.stringify(back.data)} on blur`)
    assert(contentWrites(t).length === 0, `Something was written: ${JSON.stringify(contentWrites(t))}`)
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
    await page.getByRole('tab', { name: 'Label', exact: true }).click()
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
    const [rowBox, flagBox] = [await managerPanel(page).getByTestId('manager-tab').boundingBox(), await flag.boundingBox()]
    assert(flagBox.y >= rowBox.y + 2 && flagBox.y < fieldBox.y && flagBox.y + flagBox.height <= fieldBox.y + fieldBox.height / 2, `The field flag ${JSON.stringify(flagBox)} is not on the field's top edge ${JSON.stringify(fieldBox)} at least 2px inside the bar row ${JSON.stringify(rowBox)}`)
    const glyphs = await flag.evaluate((el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      return { top: range.getBoundingClientRect().top, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }
    })
    assert(glyphs.top >= rowBox.y, `The flag's text starts at ${glyphs.top}, above the bar row at ${rowBox.y}`)
    assert(glyphs.scrollHeight <= glyphs.clientHeight, `The flag's text is ${glyphs.scrollHeight}px tall in a ${glyphs.clientHeight}px flag, so it is clipped`)
    const ring = await managerPanel(page).getByTestId('field-presence').evaluate(el => getComputedStyle(el).boxShadow)
    assert(ring.includes('inset') && ring.includes('2px'), `The peer ring is ${ring}, not a 2px inset ring`)
    await managerInput(page).focus()
    await eventually(async () => (await flag.innerText()) === 'Pat Peer is editing this too', `Focused, the flag says "${await flag.innerText()}"`)
    const focusedRing = await managerPanel(page).getByTestId('field-presence').evaluate(el => getComputedStyle(el).boxShadow)
    assert(focusedRing === 'none', `The peer ring ${focusedRing} is still drawn under your own focus ring`)
    await managerInput(page).evaluate(el => el.blur())
    await eventually(async () => (await flag.innerText()) === 'Pat Peer', `Blurred, the flag says "${await flag.innerText()}"`)
    t.publish({ ...peer, data: { v: 1, page: seed.iris.pageA, state: 'left' } })
    await eventually(async () => (await flag.count()) === 0, 'The field flag stayed after its tab left')
  })
})

function editorParagraph(page, text) {
  return page.locator('.ProseMirror p').filter({ hasText: text })
}

async function placeCaret(page, text, edge) {
  const point = await editorParagraph(page, text).evaluate((paragraph, atStart) => {
    const range = document.createRange()
    range.selectNodeContents(paragraph)
    const rects = [...range.getClientRects()]
    const rect = atStart ? rects[0] : rects.at(-1)
    return { x: atStart ? rect.left + 1 : rect.right - 1, y: rect.top + rect.height / 2 }
  }, edge === 'start')
  await page.mouse.click(point.x, point.y)
}

function caretOffset(page, text) {
  return editorParagraph(page, text).evaluate((paragraph) => {
    const selection = window.getSelection()
    if (!selection.isCollapsed || !paragraph.contains(selection.focusNode)) {
      return -1
    }
    const range = document.createRange()
    range.setStart(paragraph, 0)
    range.setEnd(selection.focusNode, selection.focusOffset)
    const before = range.cloneContents()
    before.querySelectorAll('[data-remote-cursor]').forEach(cursor => cursor.remove())
    return before.textContent.length
  })
}

function editorTexts(page) {
  return page.locator('.ProseMirror p').evaluateAll(paragraphs => paragraphs.map((paragraph) => {
    const shown = paragraph.cloneNode(true)
    shown.querySelectorAll('[data-remote-cursor]').forEach(cursor => cursor.remove())
    return shown.textContent
  }))
}

function realtimeEvent(t, { key, name, event, iri, data }) {
  return { ...peerPresence(t, { key, name, page: null }), event, iri, data }
}

function htmlWrite(t, iri, includes, from = 0) {
  return eventually(() => t.rehearsal.writes.slice(from).find(w => w.method === 'PATCH' && w.path === iri && w.body?.html?.includes(includes)), `No PATCH of ${iri} with "${includes}": ${JSON.stringify(t.rehearsal.writes)}`)
}

function base64(update) {
  return Buffer.from(update).toString('base64')
}

function realtimeSent(t, event) {
  return t.rehearsal.realtime.filter(body => body?.event === event)
}

function yjsSent(t, iri) {
  return realtimeSent(t, 'yjs:html').filter(body => body.iri === iri)
}

function isStateCreate(write) {
  return write.method === 'POST' && write.path.includes('/_/collaboration_states')
}

function contentWrites(t) {
  return t.rehearsal.writes.filter(write => !isStateCreate(write))
}

function stateCreated(t) {
  return eventually(() => t.rehearsal.writes.find(isStateCreate), `The Yjs state was never created: ${JSON.stringify(t.rehearsal.writes)}`)
}

async function peerDocument(t, iri) {
  const { member: [stored] } = await t.api.get(`/_/collaboration_states?component=${encodeURIComponent(iri)}&field=html`)
  assert(stored, `No Yjs state is stored for ${iri}`)
  const doc = new Y.Doc()
  doc.clientID = 1
  Y.applyUpdate(doc, Buffer.from(stored.state, 'base64'))
  return doc
}

function firstText(doc) {
  return doc.getXmlFragment('default').get(0).get(0)
}

test.describe('co-editing', () => {
  test('51. hiding the tab sends idle presence, and a peer going idle is dimmed in the header and loses their outline', async ({ cwa: t }) => {
    const { page, seed } = t
    await openEditMode(t)
    const viewing = await presenceSent(t, data => data.state === 'viewing' && data.page === seed.iris.pageA, 'No viewing presence was sent for the page')
    await eventually(() => t.rehearsal.mercureSubscriptions > 0, 'Mercure was never subscribed to')

    const peer = peerPresence(t, { key: '1', name: 'Pat Peer', page: seed.iris.pageA })
    const editing = { v: 1, page: seed.iris.pageA, state: 'editing', component: seed.iris.pageAOther, componentPosition: seed.positions.aOther }
    t.publish({ ...peer, data: editing })
    const outline = page.getByTestId('peer-outline')
    await eventually(async () => (await outline.count()) === 1, `There are ${await outline.count()} outlines`)
    const avatar = page.getByTestId('presence-indicator').getByTestId('presence-avatar')
    await eventually(async () => (await avatar.allInnerTexts()).join() === 'PP', `The avatars are ${JSON.stringify(await avatar.allInnerTexts())}`)
    assert(await avatar.getAttribute('data-idle') === null, 'The editing peer is shown as idle')
    assert(await avatar.evaluate(el => getComputedStyle(el).opacity) === '1', 'The editing peer is dimmed')

    t.publish({ ...peer, data: { ...editing, state: 'idle' } })
    await eventually(async () => await avatar.getAttribute('data-idle') === 'true', 'The idle peer is not marked idle')
    assert(await avatar.evaluate(el => getComputedStyle(el).opacity) === '0.5', `The idle peer has opacity ${await avatar.evaluate(el => getComputedStyle(el).opacity)}`)
    await eventually(async () => (await outline.count()) === 0, 'The idle peer is still outlined')
    await page.getByTestId('presence-indicator').click()
    const row = page.getByTestId('presence-list').getByTestId('presence-row')
    await eventually(async () => (await row.innerText()).includes('Idle'), `The row says "${await row.innerText()}"`)
    await page.keyboard.press('Escape')

    const sentBeforeHiding = t.rehearsal.realtime.length
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    const idle = await eventually(() => t.rehearsal.realtime.slice(sentBeforeHiding).find(body => body?.event === 'presence' && body.data?.state === 'idle'), `No idle presence was sent: ${JSON.stringify(t.rehearsal.realtime.slice(sentBeforeHiding))}`)
    assert(idle.clientId === viewing.clientId, `The idle presence came from ${idle.clientId}`)
    assert(idle.data.page === seed.iris.pageA, `The idle presence is for ${idle.data.page}`)
  })

  test('52. a presence from another window signed in as you shows as You (other window) with its device, not as another editor', async ({ cwa: t }) => {
    const { page, seed } = t
    const me = await t.api.get('/me')
    await openEditMode(t)
    await presenceSent(t, data => data.page === seed.iris.pageA, 'No presence was sent for the page')
    await eventually(() => t.rehearsal.mercureSubscriptions > 0, 'Mercure was never subscribed to')

    const otherWindow = peerPresence(t, { key: '9', name: 'admin', page: seed.iris.pageA })
    t.publish({ ...otherWindow, user: { id: me['@id'], name: 'admin' }, data: { v: 1, page: seed.iris.pageA, state: 'viewing', device: 'Firefox on Windows' } })

    const indicator = page.getByTestId('presence-indicator')
    const avatar = indicator.getByTestId('presence-avatar')
    await eventually(async () => (await avatar.allInnerTexts()).join() === 'You', `The avatars are ${JSON.stringify(await avatar.allInnerTexts())}`)
    assert(await avatar.getAttribute('title') === 'You (other window)', `The avatar is titled "${await avatar.getAttribute('title')}"`)
    assert(await avatar.evaluate(el => getComputedStyle(el).backgroundColor) === 'rgb(168, 162, 158)', `The avatar is ${await avatar.evaluate(el => getComputedStyle(el).backgroundColor)}`)
    assert(await indicator.getAttribute('aria-label') === 'You (other window) on this page. Show editors', `The indicator is labelled "${await indicator.getAttribute('aria-label')}"`)
    assert(await indicator.getByTestId('presence-elsewhere').count() === 0, 'Your other window is counted as an editor elsewhere')

    await indicator.click()
    const rows = page.getByTestId('presence-list').getByTestId('presence-row')
    await eventually(async () => (await rows.count()) === 1, `The list has ${await rows.count()} rows`)
    const row = await rows.innerText()
    assert(row.includes('You (other window)') && row.includes('Firefox on Windows') && row.includes('This page'), `The row is "${row}"`)
    assert(!row.includes('admin'), `The row names you as another editor: "${row}"`)
  })

  test('53. TipTap co-edits over Yjs: a peer\'s update shows in place with their cursor and name, and typing here is sent to them and saved by this window', async ({ cwa: t }) => {
    const { page, seed, settle } = t
    const live = (await t.api.create('/component/html_contents', { html: '<p>Co-edited live text</p>', publishedAt: 'now' }))['@id']
    const position = (await t.api.create('/_/component_positions', { componentGroup: seed.iris.pageAGroup, component: live }))['@id']
    await openEditMode(t)
    await editorParagraph(page, 'Co-edited live text').waitFor()
    await eventually(() => t.rehearsal.mercureSubscriptions > 0, 'Mercure was never subscribed to')
    await select(page, 'Co-edited live text')
    await stateCreated(t)
    await eventually(() => yjsSent(t, live).length > 0, 'The editor never joined over Yjs')

    const peer = peerPresence(t, { key: '1', name: 'Pat Peer', page: seed.iris.pageA })
    t.publish({ ...peer, data: { v: 1, page: seed.iris.pageA, state: 'editing', component: live, componentPosition: position, field: 'html' } })
    await eventually(async () => (await page.getByTestId('presence-avatar').count()) === 1, 'The peer never showed in the header')
    const peerDoc = await peerDocument(t, live)
    const stored = Y.encodeStateVector(peerDoc)
    const text = firstText(peerDoc)
    text.insert(0, 'Peer: ')
    t.publish(realtimeEvent(t, { key: '1', name: 'Pat Peer', event: 'yjs:html', iri: live, data: {
      id: peerDoc.clientID,
      sv: base64(Y.encodeStateVector(peerDoc)),
      ds: 0,
      update: base64(Y.encodeStateAsUpdate(peerDoc, stored)),
      cursor: { anchor: Y.createRelativePositionFromTypeIndex(text, 1), head: Y.createRelativePositionFromTypeIndex(text, 5) },
    } }))

    await eventually(async () => (await editorTexts(page)).includes('Peer: Co-edited live text'), 'The peer\'s update never showed')
    const cursor = page.locator('.ProseMirror [data-remote-cursor]')
    await eventually(async () => (await cursor.count()) === 1, `There are ${await cursor.count()} remote cursors`)
    assert(await cursor.innerText() === 'Pat Peer', `The cursor is labelled "${await cursor.innerText()}"`)
    const highlighted = page.locator('.ProseMirror [data-remote-selection]')
    assert(await highlighted.innerText() === 'eer:', `The peer's selection covers "${await highlighted.innerText()}"`)
    await settle()
    const htmlWrites = () => t.rehearsal.writes.filter(w => w.method === 'PATCH' && w.body && 'html' in w.body)
    assert(htmlWrites().length === 0, `The peer's typing was saved by this window: ${JSON.stringify(htmlWrites())}`)

    const sentBeforeTyping = yjsSent(t, live).length
    await placeCaret(page, 'Co-edited live text', 'end')
    await eventually(async () => await caretOffset(page, 'Co-edited live text') === 'Peer: Co-edited live text'.length, 'The caret is not at the end of the text')
    await page.keyboard.type(' and mine')
    await htmlWrite(t, live, 'Peer: Co-edited live text and mine')
    await eventually(() => {
      yjsSent(t, live).slice(sentBeforeTyping).forEach(body => body.data.update && Y.applyUpdate(peerDoc, Buffer.from(body.data.update, 'base64')))
      return firstText(peerDoc).toString() === 'Peer: Co-edited live text and mine'
    }, `The typing never reached the peer: "${firstText(peerDoc).toString()}"`)
    await settle()
    const stateWrites = t.rehearsal.writes.filter(w => w.method === 'PATCH' && w.path.includes('/_/collaboration_states'))
    assert(stateWrites.length === 0, `The window that does not save for everyone wrote the state: ${JSON.stringify(stateWrites)}`)
  })

  test('54. moving the caret in TipTap sends it inside coalesced Yjs events, the last ending at the caret', async ({ cwa: t }) => {
    const { page, seed, settle } = t
    await openEditMode(t)
    await select(page, texts.pageAOther)
    await stateCreated(t)
    await placeCaret(page, texts.pageAOther, 'start')
    await eventually(async () => await caretOffset(page, texts.pageAOther) === 0, 'The caret is not at the start of the text')
    const doc = await peerDocument(t, seed.iris.pageAOther)
    const caretOf = body => body.data?.cursor && Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(body.data.cursor.head), doc)?.index
    await eventually(() => yjsSent(t, seed.iris.pageAOther).some(body => caretOf(body) === 0), `The caret at the start was never sent: ${JSON.stringify(yjsSent(t, seed.iris.pageAOther).map(body => body.data.cursor))}`)
    await settle()

    const before = yjsSent(t, seed.iris.pageAOther).length
    const posted = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/_/realtime') && request.postDataJSON()?.event === 'yjs:html') {
        posted.push(request)
      }
    })
    const moves = 12
    for (let i = 0; i < moves; i++) {
      await page.keyboard.press('ArrowRight')
    }
    assert(await caretOffset(page, texts.pageAOther) === moves, `The caret is at ${await caretOffset(page, texts.pageAOther)}`)
    const last = await eventually(() => yjsSent(t, seed.iris.pageAOther).slice(before).find(body => caretOf(body) === moves), `The final caret was never sent: ${JSON.stringify(yjsSent(t, seed.iris.pageAOther).slice(before).map(body => body.data.cursor))}`)
    await settle()
    const sent = yjsSent(t, seed.iris.pageAOther).slice(before)
    assert(sent.length < moves, `${sent.length} Yjs events were sent for ${moves} moves`)
    const starts = posted.map(request => request.timing().startTime)
    const gaps = starts.slice(1).map((start, i) => start - starts[i])
    assert(gaps.every(gap => gap >= 115), `The Yjs events were sent ${JSON.stringify(gaps)}ms apart`)
    assert(sent.at(-1) === last, `The last event sent is ${JSON.stringify(sent.at(-1))}`)
    assert(caretOf(last) === moves && Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(last.data.cursor.anchor), doc)?.index === moves, `Sent ${JSON.stringify(last.data.cursor)}`)
    assert(realtimeSent(t, 'selection').length === 0, 'A selection event was sent')
    assert(contentWrites(t).length === 0, `Something was written: ${JSON.stringify(contentWrites(t))}`)
  })
})

test.describe('resource stack', () => {
  test('55. right-clicking a component, the innermost box\'s corner sits on the pointer at the centre, the right edge and above the bottom edge, and at the bottom edge the panel shifts to stay 8px inside', async ({ cwa: t }) => {
    const { page } = t
    await page.setViewportSize({ width: 1280, height: 900 })
    await openEditMode(t)
    const component = page.getByText(texts.source, { exact: true }).first()
    await component.waitFor()

    async function openAt(x, y) {
      await component.evaluate((el, [clientX, clientY]) => el.dispatchEvent(new MouseEvent('contextmenu', { clientX, clientY, button: 2, bubbles: true, cancelable: true })), [x, y])
      const panel = page.getByTestId('resource-stack')
      await eventually(async () => await panel.count() === 1 && await panel.evaluate(el => el.style.visibility !== 'hidden'), `The stack did not show at ${x}, ${y}`)
      await panel.evaluate(el => Promise.all([el, el.parentElement].flatMap(element => element.getAnimations()).map(animation => animation.finished)))
      const boxes = await panel.evaluate((el) => {
        const inner = el.querySelector('[data-stack-innermost]').getBoundingClientRect()
        const outer = el.getBoundingClientRect()
        return { inner: { left: inner.left, top: inner.top, right: inner.right, bottom: inner.bottom }, panel: { left: outer.left, top: outer.top, right: outer.right, bottom: outer.bottom } }
      })
      await page.keyboard.press('Escape')
      await eventually(async () => await panel.count() === 0, 'The stack did not close on Escape')
      return boxes
    }
    const near = (a, b) => Math.abs(a - b) <= 1

    const centre = await openAt(640, 450)
    assert(near(centre.inner.left, 640) && near(centre.inner.top, 450), `At the centre the innermost box's top-left is ${JSON.stringify(centre.inner)}, not on the pointer`)

    const right = await openAt(1220, 450)
    assert(near(right.inner.right, 1220) && near(right.inner.top, 450), `60px from the right edge the innermost box's top-right is ${JSON.stringify(right.inner)}, not on the pointer`)
    assert(right.panel.right <= 1272, `60px from the right edge the panel ends at ${right.panel.right}`)

    const below = centre.panel.bottom - centre.inner.bottom
    const lowY = Math.round(892 - below - (centre.inner.bottom - centre.inner.top) / 2)
    const low = await openAt(640, lowY)
    assert(near(low.inner.left, 640) && near(low.inner.bottom, lowY), `At ${lowY}, where only a bottom corner fits, the innermost box's bottom-left is ${JSON.stringify(low.inner)}, not on the pointer`)

    const bottom = await openAt(640, 840)
    assert(near(bottom.inner.left, 640), `60px from the bottom the innermost box's left is ${bottom.inner.left}, not at the pointer`)
    assert(bottom.inner.bottom <= 840 + 1, `60px from the bottom the innermost box ends at ${bottom.inner.bottom}, below the pointer`)
    assert(bottom.panel.bottom <= 892 + 1 && bottom.panel.bottom >= 892 - 1, `60px from the bottom the panel ends at ${bottom.panel.bottom}, not 8px inside the window`)
  })
})

test.describe('in-page editing', () => {
  test('56. on a phone a long press on a component opens the resource stack as a bottom sheet, and a swipe down on its handle shuts it', async ({ cwa: t }) => {
    const { page } = t
    await page.setViewportSize({ width: 390, height: 844 })
    await openEditMode(t)
    const component = page.getByText(texts.source, { exact: true }).first()
    await component.waitFor()

    await component.evaluate((el) => {
      const { left, top, width, height } = el.getBoundingClientRect()
      el.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: left + width / 2, clientY: top + height / 2, bubbles: true, cancelable: true }))
    })
    const sheet = page.getByTestId('resource-stack')
    await eventually(async () => await sheet.count() === 1 && await sheet.getAttribute('aria-modal') === 'true', 'The long press never opened the stack as a sheet')
    await sheet.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished)))
    const box = await sheet.boundingBox()
    assert(Math.abs(box.y + box.height - 844) <= 1 && box.width >= 389, `The sheet is not along the bottom edge: ${JSON.stringify(box)}`)

    const grip = await page.getByTestId('resource-stack-grip').boundingBox()
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
    await page.mouse.down()
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + 300, { steps: 4 })
    await page.mouse.up()
    await eventually(async () => await sheet.count() === 0, 'A swipe down did not shut the sheet')
  })

  test('57. a title is edited where it sits on the page: Enter saves it, and while a save has failed Escape opens the bar status on Retry, which saves it', async ({ cwa: t }) => {
    const { page, seed } = t
    const title = (await t.api.create('/component/titles', { title: 'Title on the page' }))['@id']
    await t.api.create('/_/component_positions', { componentGroup: seed.iris.pageAGroup, component: title })
    await openEditMode(t)

    const shown = page.getByTestId('inline-edit-value').filter({ hasText: 'Title on the page' })
    await shown.click()
    const input = page.getByPlaceholder('Add a title')
    await input.fill('Title edited on the page')
    await input.press('Enter')

    await eventually(() => t.rehearsal.writes.find(w => w.method === 'PATCH' && w.path.startsWith(title) && w.body?.title === 'Title edited on the page'), `No PATCH of the title: ${JSON.stringify(t.rehearsal.writes)}`)
    await page.getByTestId('inline-edit-value').filter({ hasText: 'Title edited on the page' }).waitFor()
    await t.settle()

    t.allowConsoleErrors(/^Failed to load resource: the server responded with a status of 500/)
    let refused = false
    await page.route(url => url.pathname.includes('/component/titles/'), (route) => {
      if (refused || route.request().method() !== 'PATCH') {
        return route.fallback()
      }
      refused = true
      return route.fulfill({ status: 500, contentType: 'application/ld+json', body: '{}' })
    })
    await page.getByTestId('inline-edit-value').filter({ hasText: 'Title edited on the page' }).click()
    await input.fill('Title that will not save')
    await input.press('Enter')
    const status = page.getByTestId('bar-summary')
    await eventually(async () => await status.getAttribute('data-state') === 'error', 'The bar status never showed the failed save')

    await page.getByTestId('inline-edit-value').filter({ hasText: 'Title that will not save' }).click()
    expect(await input.getAttribute('aria-invalid')).toBe('true')
    await input.press('Escape')
    const retry = page.getByTestId('bar-summary-popover').getByRole('button', { name: 'Retry' })
    await eventually(() => retry.evaluate(el => document.activeElement === el), 'Escape from the failed editor did not open the bar status on Retry')
    expect(await page.getByTestId('bar-summary-popover').getAttribute('aria-label')).toBe('Title: not saved')

    await page.keyboard.press('Enter')
    await eventually(() => t.rehearsal.writes.find(w => w.method === 'PATCH' && w.body?.title === 'Title that will not save'), `Retry sent no PATCH: ${JSON.stringify(t.rehearsal.writes)}`)
    await eventually(async () => await status.getAttribute('data-state') !== 'error' && await page.getByTestId('bar-summary-popover').count() === 0, 'Retry did not clear the failed save')
    expect(await page.getByTestId('inline-edit-value').filter({ hasText: 'Title that will not save' }).getAttribute('aria-invalid')).toBeNull()
  })

  test('58. the Content tab\'s Edit on page focuses the rich-text editor on the page, and Escape there returns to the button', async ({ cwa: t }) => {
    const { page } = t
    await openEditMode(t)
    await select(page, texts.source)

    const button = page.getByTestId('inline-handoff-edit')
    await eventually(async () => (await button.textContent()).trim() === 'Edit on page', 'The Content tab never offered Edit on page')
    await button.click()
    await eventually(() => page.evaluate(() => document.activeElement?.classList.contains('ProseMirror')), 'Edit on page did not focus the editor')

    await page.keyboard.press('Escape')
    await eventually(() => button.evaluate(el => document.activeElement === el), 'Escape did not return to Edit on page')
  })

  test('59. Link in the rich-text editor opens the link popover, and Enter links the selected words', async ({ cwa: t }) => {
    const { page, settle } = t
    await openEditMode(t)
    await select(page, texts.source)

    await placeCaret(page, texts.source, 'start')
    await page.keyboard.press('Shift+End')
    await page.getByRole('button', { name: 'Link', exact: true }).click()
    const popover = page.getByTestId('link-popover')
    await popover.waitFor()
    const url = popover.getByRole('textbox', { name: 'URL' })
    await eventually(() => url.evaluate(el => document.activeElement === el), 'The URL field was not focused')
    await url.fill('/kitchens')
    await url.press('Enter')

    await eventually(() => t.rehearsal.writes.find(w => w.method === 'PATCH' && w.body?.html?.includes('href="/kitchens"')), `No PATCH with the link: ${JSON.stringify(t.rehearsal.writes)}`)
    assert(await popover.count() === 0, 'The popover stayed open after Enter')
    await settle()
  })

  test('60. empty placeholders show only in edit mode: a draft-only position shows nothing to an admin who is not editing, and its draft once editing', async ({ cwa: t }) => {
    const { page, seed, settle } = t
    const draft = (await t.api.create('/component/html_contents', { html: '<p>Draft only text</p>' }))['@id']
    await t.api.create('/_/component_positions', { componentGroup: seed.iris.pageAGroup, component: draft })

    await page.goto(`${t.base}${seed.paths.home}`)
    await page.getByRole('button', { name: 'Edit', exact: true }).waitFor()
    await page.getByText(texts.source, { exact: true }).first().waitFor()
    await settle()
    assert(await page.getByTestId('edit-placeholder').count() === 0, 'An admin who is not editing sees a placeholder')
    assert(await page.getByText('Draft only text').count() === 0, 'An admin who is not editing sees the draft')

    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).waitFor()
    await page.getByText('Draft only text').first().waitFor()
    const placeholder = page.getByRole('group', { name: 'Empty group' }).first()
    await placeholder.waitFor()
    assert((await placeholder.evaluate((element) => {
      const shown = element.cloneNode(true)
      shown.querySelectorAll('.cwa\\:sr-only').forEach(hidden => hidden.remove())
      return shown.textContent
    })).trim() === '', 'The empty group shows text')
    assert(await page.getByTestId('edit-placeholder-tooltip').count() === 0, 'The empty group shows its explanation before the + is hovered')
    await placeholder.getByRole('button', { name: 'Add component position' }).hover()
    await page.getByTestId('edit-placeholder-tooltip').filter({ hasText: 'Visitors see nothing here' }).waitFor()
  })
})

test('61. outside edit mode the header\'s Edit button and menu sit on the header bar\'s centre, level with the page settings button', async ({ cwa: t }) => {
  const { page, base, settle, seed } = t
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto(`${base}${seed.paths.home}`)
    await page.getByRole('button', { name: 'Edit', exact: true }).waitFor()
    await settle()
    const centres = await page.evaluate(() => {
      const middle = (element) => {
        const box = element.getBoundingClientRect()
        return box.top + box.height / 2
      }
      const menu = [...document.querySelectorAll('button')].find(button => button.querySelector('.cwa\\:sr-only')?.textContent === 'Menu')
      const header = menu.closest('.cwa\\:fixed')
      const box = header.getBoundingClientRect()
      return {
        bar: box.top + (box.height - Number.parseFloat(getComputedStyle(header).borderBottomWidth)) / 2,
        menu: middle(menu.querySelector('svg')),
        edit: middle([...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Edit')),
        settings: middle(document.querySelector('[data-testid="page-settings"]')),
      }
    })
    for (const name of ['menu', 'edit', 'settings']) {
      assert(Math.abs(centres[name] - centres.bar) < 0.5, `At ${width}px the ${name} is centred at ${centres[name]}, the bar at ${centres.bar}`)
    }
  }
})

test('62. with live editing paused on a phone, the header\'s status is a glyph named for it beside Edit, clear of the page settings button and the menu, and a tap shows its text', async ({ cwa: t }) => {
  const { page, base, settle, seed } = t
  t.allowConsoleErrors(/^Failed to load resource: net::ERR_FAILED/)
  await page.route(`**${mercurePath}**`, route => route.abort())
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto(`${base}${seed.paths.home}`)
    await page.getByRole('button', { name: 'Edit', exact: true }).waitFor()
    const glyph = page.getByTestId('presence-paused-glyph')
    await glyph.waitFor()
    await settle()
    const boxes = await page.evaluate(() => {
      const box = (element) => {
        const { left, right } = element.getBoundingClientRect()
        return { left, right }
      }
      const menu = [...document.querySelectorAll('button')].find(button => button.querySelector('.cwa\\:sr-only')?.textContent === 'Menu')
      return {
        edit: box([...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Edit')),
        status: box(document.querySelector('[data-testid="presence-paused"]')),
        settings: box(document.querySelector('[data-testid="page-settings"]')),
        menu: box(menu.querySelector('svg')),
      }
    })
    const order = ['edit', 'status', 'settings', 'menu']
    for (let index = 1; index < order.length; index++) {
      const [before, after] = [order[index - 1], order[index]]
      assert(boxes[before].right <= boxes[after].left, `At ${width}px the ${before} (${boxes[before].left}–${boxes[before].right}) overlaps the ${after} (${boxes[after].left}–${boxes[after].right})`)
    }
    assert(boxes.menu.right <= width, `At ${width}px the menu ends at ${boxes.menu.right}`)
    assert(await glyph.getAttribute('aria-label') === null && (await glyph.textContent()).trim() === 'Live editing paused', 'The glyph is named "Live editing paused"')
    assert(await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="presence-paused"] > span')).display) === 'none', 'The status text is hidden on a phone')
    await glyph.click()
    await page.getByTestId('presence-paused-tip').waitFor()
    await page.getByTestId('presence-paused-tip').waitFor({ state: 'detached', timeout: 4000 })
  }
})

test('63. the header\'s Edit or Done button and the page settings button or path selector beside it share one height and one centre, at 1280 and 390, with a fine or a coarse pointer, while live editing is paused, and the manager bar\'s tabs and their group are exactly as tall as its CTA buttons and the controls in its panel', async ({ cwa: t }) => {
  const { page, base, seed } = t
  const cookies = await page.context().cookies()
  for (const hasTouch of [false, true]) {
    for (const width of [1280, 390]) {
      const context = await page.context().browser().newContext({ ignoreHTTPSErrors: true, viewport: { width, height: 800 }, hasTouch })
      await context.addCookies(cookies)
      const tab = await context.newPage()
      await tab.route(`**${mercurePath}**`, route => route.abort())
      const settle = async () => {
        await tab.waitForLoadState('networkidle')
      }
      const measure = async (testId) => {
        const boxes = await tab.evaluate((id) => {
          const box = (element) => {
            const { top, height } = element.getBoundingClientRect()
            return { height, centre: top + height / 2 }
          }
          return {
            coarse: matchMedia('(pointer: coarse)').matches,
            cta: box([...document.querySelectorAll('button')].find(button => ['Edit', 'Done'].includes(button.textContent.trim()))),
            beside: box(document.querySelector(`[data-testid="${id}"]`)),
          }
        }, testId)
        assert(boxes.coarse === hasTouch, `The pointer is ${boxes.coarse ? 'coarse' : 'fine'}`)
        const where = `At ${width}px with a ${hasTouch ? 'coarse' : 'fine'} pointer, the CTA and ${testId}`
        assert(Math.abs(boxes.cta.height - boxes.beside.height) <= 1, `${where} are ${boxes.cta.height}px and ${boxes.beside.height}px tall`)
        assert(Math.abs(boxes.cta.centre - boxes.beside.centre) <= 1, `${where} are centred at ${boxes.cta.centre} and ${boxes.beside.centre}`)
      }
      await tab.goto(`${base}${seed.paths.home}`)
      await tab.getByRole('button', { name: 'Edit', exact: true }).waitFor()
      await tab.getByTestId('presence-paused').waitFor()
      await settle()
      await measure('page-settings')
      await tab.getByRole('button', { name: 'Edit', exact: true }).click()
      await tab.getByRole('button', { name: 'Done', exact: true }).waitFor()
      await tab.getByText(texts.source, { exact: true }).first().click()
      await tab.getByTestId('path-selector').waitFor()
      await settle()
      await measure('path-selector')
      await tab.getByTestId('manager-pin').getByRole('button').first().waitFor()
      await settle()
      const bar = await tab.evaluate(() => {
        const height = element => element.getBoundingClientRect().height
        const pin = document.querySelector('[data-testid="manager-pin"]')
        const tablist = document.querySelector('[data-testid="manager-bar"] [role="tablist"]')
        const selected = tablist.querySelector('[role="tab"][aria-selected="true"]')
        const indicators = tablist.querySelectorAll('[data-testid="tab-indicator"]')
        const underline = indicators[0].getBoundingClientRect()
        const tabBox = selected.getBoundingClientRect()
        return {
          total: height(document.querySelector('[data-testid="manager-bar"]')),
          tabs: [...tablist.querySelectorAll('[role="tab"]')].map(height),
          indicators: indicators.length,
          underline: { bottom: underline.bottom, height: underline.height, offLeft: Math.abs(underline.left - tabBox.left), offWidth: Math.abs(underline.width - tabBox.width) },
          line: tablist.parentElement.getBoundingClientRect().bottom,
          clip: tablist.getBoundingClientRect().bottom,
          panel: [...document.querySelectorAll('[data-testid="manager-tab-panel"] :is(button, [role="combobox"], [data-testid="segmented"])')].filter(element => element.offsetParent && !element.closest('[data-testid="field-info"], [data-testid="segmented"] button, .cwa\\:sr-only')).map(element => ({ name: (element.getAttribute('aria-label') ?? element.textContent).trim().slice(0, 30), height: height(element) })),
          ctas: [...pin.querySelectorAll('button')].filter(button => button.offsetParent && /Publish|More|actions|⋮/i.test(`${button.textContent} ${button.getAttribute('aria-label') ?? ''}`)).map(button => ({ name: (button.getAttribute('aria-label') ?? button.textContent).trim(), height: height(button) })),
        }
      })
      const where = `At ${width}px with a ${hasTouch ? 'coarse' : 'fine'} pointer`
      assert(bar.ctas.length >= 1, `${where} the bar shows ${bar.ctas.map(cta => cta.name).join(', ') || 'no'} CTA buttons`)
      for (const cta of bar.ctas) {
        for (const height of bar.tabs) {
          assert(Math.abs(height - cta.height) <= 1, `${where} a tab is ${height}px tall and ${cta.name} ${cta.height}px`)
        }
        assert(!hasTouch || cta.height >= 44, `${where} ${cta.name} is ${cta.height}px tall, under the 44px hit size`)
      }
      assert(bar.panel.length >= 1, `${where} the bar's panel shows no controls`)
      for (const control of bar.panel) {
        assert(Math.abs(control.height - bar.ctas[0].height) <= 1, `${where} ${control.name} in the bar's panel is ${control.height}px tall and ${bar.ctas[0].name} ${bar.ctas[0].height}px`)
      }
      const rows = await tab.evaluate(controlRows, '[data-testid="manager-bar"]')
      assert(rows.problems.length === 0, `${where} the bar's rows differ: ${rows.problems.join('; ')}`)
      for (const height of bar.tabs) {
        assert(!hasTouch || height >= 44, `${where} a tab is ${height}px tall, under the 44px hit size`)
      }
      assert(bar.indicators === 1, `${where} the tab row has ${bar.indicators} indicators`)
      assert(bar.underline.height === 2 && bar.underline.offLeft <= 0.5 && bar.underline.offWidth <= 0.5, `${where} the tab indicator is not under the selected tab: ${JSON.stringify(bar.underline)}`)
      assert(Math.abs(bar.underline.bottom - bar.line) <= 0.5, `${where} the selected tab's underline ends at ${bar.underline.bottom}, not on the bar's line at ${bar.line}`)
      assert(bar.underline.bottom <= bar.clip + 0.5, `${where} the underline ends at ${bar.underline.bottom}, below the tab row it is clipped by at ${bar.clip}`)
      assert(bar.total === (hasTouch ? 112 : 100), `${where} the bar is ${bar.total}px tall`)
      await context.close()
    }
  }
})

test('64. by keyboard alone a rich-text component is reached with Tab, selected with Enter, its stack opened with Shift+F10, and F6 then the arrow keys reach its Publish tab', async ({ cwa: t }) => {
  const { page } = t
  await openEditMode(t)

  let reached = false
  for (let tabs = 0; tabs < 80 && !reached; tabs++) {
    await page.keyboard.press('Tab')
    reached = await page.evaluate(text => document.activeElement?.getAttribute('aria-label') === 'Body Text component' && !!document.activeElement.textContent?.includes(text), texts.source)
  }
  assert(reached, 'Tab never reached the Body Text component')

  await page.keyboard.press('Shift+F10')
  const stack = page.getByTestId('resource-stack')
  await stack.waitFor()
  await page.keyboard.press('Escape')
  await stack.waitFor({ state: 'detached' })
  await eventually(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Body Text component'), 'Focus did not come back to the component')

  await page.keyboard.press('Enter')
  await page.getByTestId('component-menu').waitFor()
  await page.getByRole('textbox', { name: 'Content, Body Text' }).filter({ hasText: texts.source }).waitFor()

  const tablist = page.getByRole('tablist', { name: 'Body Text settings' })
  await tablist.getByRole('tab', { selected: true }).waitFor()
  await page.keyboard.press('F6')
  await eventually(() => tablist.evaluate(el => el.contains(document.activeElement)), 'F6 did not move focus to the manager bar\'s tabs')
  for (let moves = 0; moves < 8 && (await page.evaluate(() => document.activeElement?.textContent?.trim())) !== 'Publish'; moves++) {
    await page.keyboard.press('ArrowRight')
  }
  const publish = tablist.getByRole('tab', { name: 'Publish', exact: true })
  await eventually(async () => (await publish.getAttribute('aria-selected')) === 'true', 'The arrow keys never selected Publish')
  assert(await page.getByRole('tabpanel', { name: 'Publish' }).count() === 1, 'The shown tab is not a tabpanel named Publish')

  await page.keyboard.press('Shift+F6')
  await eventually(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Body Text component'), 'Shift+F6 did not return to the component')
})

test('65. a shared component with unpublished changes offers Remove from here, Delete draft and Delete entire component in one row with Cancel on its own side, focuses Remove from here, and Remove from here takes only this instance off the page (#461)', async ({ cwa: t }) => {
  const { page, settle } = t
  const draftText = 'Shared source component, unpublished'
  const draft = await t.api.patch(t.seed.iris.source, { html: `<p>${draftText}</p>` })
  t.api.track(draft['@id'])
  await openEditMode(t)
  await select(page, draftText)
  await page.getByRole('tab', { name: 'Info', exact: true }).click()
  await page.getByTestId('component-delete').getByRole('button', { name: 'Delete', exact: true }).click()
  const dialog = dialogWith(page, 'Delete this component?')
  await dialog.getByText('It is used in 2 places and has unpublished changes.').waitFor()
  const labels = await dialog.getByRole('button').allInnerTexts()
  assert(JSON.stringify(labels.map(label => label.trim())) === JSON.stringify(['Cancel', 'Remove from here', 'Delete draft', 'Delete entire component']), `The choices are ${JSON.stringify(labels)}`)
  await dialog.getByText('Delete entire component deletes the draft and the live version from all 2 places it is used.').waitFor()
  await dialog.getByText('Neither delete can be undone.').waitFor()
  await eventually(() => dialog.getByRole('button', { name: 'Remove from here', exact: true }).evaluate(el => el === document.activeElement), 'Remove from here is not focused')
  const boxes = await Promise.all(['Cancel', 'Remove from here', 'Delete draft', 'Delete entire component'].map(name => dialog.getByRole('button', { name, exact: true }).boundingBox()))
  assert(new Set(boxes.map(box => Math.round(box.y))).size === 1, `The buttons are not in one row: ${JSON.stringify(boxes)}`)
  assert(boxes[1].x - (boxes[0].x + boxes[0].width) > boxes[2].x - (boxes[1].x + boxes[1].width), `Cancel is not on its own side: ${JSON.stringify(boxes)}`)
  await dialog.getByRole('button', { name: 'Remove from here', exact: true }).click()
  const del = await eventually(() => t.rehearsal.writes.find(w => w.method === 'DELETE'), 'Nothing was DELETEd')
  assert(del.path === t.seed.positions.aSource, `DELETEd ${del.path}`)
  await eventually(async () => (await page.getByText(draftText, { exact: true }).count()) === 0, 'The removed instance is still on the page')
  await settle()
  assert(t.rehearsal.writes.filter(w => w.method === 'DELETE').length === 1, `DELETEd ${JSON.stringify(t.rehearsal.writes.filter(w => w.method === 'DELETE').map(w => w.path))}`)
  assert(await t.api.status(t.seed.iris.source) === 200, 'The live component was deleted')
  assert(await t.api.status(draft['@id']) === 200, 'The draft was deleted')
})

test('66. at 390 wide the UI tab\'s row shows its fade and scrolls by keyboard, and focusing the Style select brings all of it into the row, with a fine or a coarse pointer', async ({ cwa: t }) => {
  const { page, base, seed } = t
  const cookies = await page.context().cookies()
  for (const hasTouch of [false, true]) {
    const context = await page.context().browser().newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, hasTouch })
    await context.addCookies(cookies)
    const tab = await context.newPage()
    await tab.route(`**${mercurePath}**`, route => route.abort())
    await tab.goto(`${base}${seed.paths.home}`)
    await tab.getByRole('button', { name: 'Edit', exact: true }).waitFor()
    await tab.waitForLoadState('networkidle')
    await tab.getByRole('button', { name: 'Edit', exact: true }).click()
    await tab.getByRole('button', { name: 'Done', exact: true }).waitFor()
    await tab.getByText(texts.source, { exact: true }).first().click()
    await tab.getByRole('tab', { name: 'UI', exact: true }).click()
    const style = tab.getByTestId('manager-tab-panel').getByRole('combobox', { name: 'Style', exact: true })
    await style.waitFor()
    await tab.waitForLoadState('networkidle')
    const fit = await style.evaluate((input) => {
      const field = input.parentElement
      let scroller = field.parentElement
      while (scroller && getComputedStyle(scroller).overflowX !== 'auto') {
        scroller = scroller.parentElement
      }
      const cue = { overflows: scroller.scrollWidth > scroller.clientWidth + 1, fade: scroller.parentElement.dataset.overflowEnd === 'true', tabindex: scroller.getAttribute('tabindex') }
      scroller.scrollLeft = 0
      input.focus()
      const box = field.getBoundingClientRect()
      const view = scroller.getBoundingClientRect()
      return { ...cue, left: Math.round(box.left), right: Math.round(box.right), viewLeft: Math.round(view.left), viewRight: Math.round(view.right), page: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }
    })
    assert(!fit.overflows || (fit.fade && fit.tabindex === '0'), `With a ${hasTouch ? 'coarse' : 'fine'} pointer the row overflows with no fade or keyboard scroll: ${JSON.stringify(fit)}`)
    assert(fit.left >= fit.viewLeft - 1 && fit.right <= fit.viewRight + 1 && fit.right <= fit.page, `With a ${hasTouch ? 'coarse' : 'fine'} pointer the Style select is cut off: ${JSON.stringify(fit)}`)
    await context.close()
  }
})

test('68. in edit mode a layout link asks to edit the layout first; Cancel opens nothing and keeps the page selection; confirming clears it and only then opens a menu at the click point with Edit focused, which selects without asking again; in the layout a layout link opens the menu at once, and Visit follows a redirect and stays in edit mode', async ({ cwa: t }) => {
  const { page, base, settle } = t
  await openEditMode(t)
  await select(page, texts.pageAOther)
  const box = await layoutLink(page, 'Second').boundingBox()
  const point = { x: box.x + 4, y: box.y + box.height / 2 }
  const menu = linkMenu(page)
  const confirm = dialogWith(page, 'Edit the shared layout?')

  await page.mouse.click(point.x, point.y)
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).waitFor()
  assert(!(await menu.count()), 'The link menu opened before the scope was confirmed')
  assert(!(await confirm.getByRole('button', { name: /Visit/ }).count()), 'The scope confirm offers Visit')
  assert(page.url() === `${base}${t.seed.paths.home}`, `The click navigated to ${page.url()}`)
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click()
  await waitForNoDialog(page, 'Cancel did not close the confirm')
  await settle()
  assert(!(await menu.count()), 'Cancel on the scope confirm opened the link menu')
  assert(await page.getByTestId('component-menu').isVisible(), 'Cancel on the scope confirm cleared the page selection')

  await page.mouse.click(point.x, point.y)
  await confirm.getByRole('button', { name: 'Edit layout', exact: true }).click()
  const edit = menu.getByTestId('link-menu-edit')
  await edit.waitFor()
  await page.getByTestId('component-menu').waitFor({ state: 'detached' }).catch(() => {
    throw new AssertionError('Switching to the layout kept the page component selected')
  })
  const rows = await menu.getByRole('menuitem').allInnerTexts()
  assert(rows.length === 2 && rows[0].startsWith('Edit ') && rows[1] === `Visit ${t.seed.paths.second}`, `The menu lists ${JSON.stringify(rows)}`)
  await eventually(() => edit.evaluate(el => el === document.activeElement), 'Edit is not focused')
  const menuBox = await settledBox(menu)
  assert(Math.abs(menuBox.x - point.x) <= 2 && menuBox.y >= point.y && menuBox.y - point.y <= 8, `The menu is at ${JSON.stringify(menuBox)}, not at the click point ${JSON.stringify(point)}`)
  assert(page.url() === `${base}${t.seed.paths.home}`, `The confirm navigated to ${page.url()}`)

  await page.keyboard.press('Enter')
  await page.getByTestId('component-menu').waitFor()
  await settle()
  assert(await dialogs(page).count() === 0, `Edit asked again: ${await dialogTexts(page)}`)
  assert(page.url() === `${base}${t.seed.paths.home}`, `Edit navigated to ${page.url()}`)

  await layoutLink(page, 'Redirect').click()
  await menu.getByTestId('link-menu-visit').click()
  await assertOnSecondPage(t)
  assert(!page.url().includes('cwa_force'), `The address kept cwa_force: ${page.url()}`)
  assert(await dialogs(page).count() === 0, `A dialog opened: ${await dialogTexts(page)}`)
  await page.getByRole('button', { name: 'Done', exact: true }).waitFor()

  await layoutLink(page, 'Home').click()
  await menu.getByTestId('link-menu-visit').click()
  await eventually(() => page.url() === `${base}${t.seed.paths.home}`, `Expected ${t.seed.paths.home}, at ${page.url()}`)
  await page.getByText(texts.pageAOther, { exact: true }).waitFor()
  await settle()
  await page.getByRole('button', { name: 'Done', exact: true }).waitFor()
})

test('69. in edit mode and clone mode a faint outline fades in on the component under the pointer, never on the selected one', async ({ cwa: t }) => {
  const { page, settle } = t
  await openEditMode(t)
  await settle()
  const hoverOutline = page.getByTestId('hover-outline')
  const outlineOver = async (text) => {
    const target = page.getByText(text, { exact: true }).first()
    const box = await target.boundingBox()
    await page.mouse.move(box.x + 4, box.y + box.height / 2)
    const [rect] = await boxesOf(page, text)
    return eventually(async () => {
      const [drawn] = await hoverOutline.evaluateAll(els => els.map((el) => {
        const r = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return { top: r.top, left: r.left, width: r.width, height: r.height, opacity: Number(style.opacity), width_: Number.parseFloat(style.outlineWidth), animation: style.animationName }
      }))
      return drawn && covers(drawn, rect) && drawn.opacity === 1 ? drawn : undefined
    }, `No outline was drawn over "${text}"`)
  }

  const cursorOver = text => page.getByText(text, { exact: true }).first().evaluate((el) => {
    const r = el.getBoundingClientRect()
    return getComputedStyle(document.elementFromPoint(r.left + 4, r.top + r.height / 2)).cursor
  })

  const drawn = await outlineOver(texts.pageAOther)
  assert(drawn.width_ === 1, `The hover outline is ${drawn.width_}px, not 1px`)
  assert(drawn.animation === 'cwa-line-in', `The hover outline does not fade in (${drawn.animation})`)
  const outlinedCursor = await cursorOver(texts.pageAOther)
  assert(outlinedCursor === 'crosshair', `The cursor over the outlined component is ${outlinedCursor}`)

  await select(page, texts.pageAOther)
  const box = await page.getByText(texts.pageAOther, { exact: true }).boundingBox()
  await page.mouse.move(box.x + 6, box.y + box.height / 2)
  await settle()
  assert(await hoverOutline.count() === 0, 'The selected component has a hover outline too')

  await page.keyboard.press('Escape')
  await startClone(page)
  await outlineOver(texts.pageAOther)
  assert(await cursorOver(texts.pageAOther) === 'crosshair', 'The cursor over the outlined component in clone mode is not a crosshair')

  await page.keyboard.press('Escape')
  await page.getByTestId('clone-mode-bar').waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).waitFor()
  const otherBox = await page.getByText(texts.pageAOther, { exact: true }).first().boundingBox()
  await page.mouse.move(otherBox.x + 8, otherBox.y + otherBox.height / 2)
  await settle()
  const viewingCursor = await cursorOver(texts.pageAOther)
  assert(viewingCursor !== 'crosshair', 'The cursor is still a crosshair after leaving edit mode')
  assert(await page.locator('[data-cwa-hovered]').count() === 0, 'A component is still marked as hovered after leaving edit mode')
})

test('72. selecting another component paints no outline and lightens no part of the page outside the two components in any frame between them (#461)', async ({ cwa: t }) => {
  const { page, settle } = t
  await openEditMode(t)
  await select(page, texts.source)
  await settle()
  const [from] = await boxesOf(page, texts.source)
  const [to] = await boxesOf(page, texts.pageAOther)
  await page.evaluate(({ from, to }) => {
    const cutout = 8
    const within = (top, bottom, slack) => [from, to].some(box => top >= box.top - slack && bottom <= box.top + box.height + slack)
    const x = Math.round(Math.max(from.left, to.left) + Math.min(from.width, to.width) / 2)
    window.__paints = { frames: 0, stray: [] }
    const sample = () => {
      window.__paints.frames++
      for (const outline of document.querySelectorAll('[data-testid="focus-outline"], [data-testid="hover-outline"], [data-testid="shared-instance-outline"]')) {
        const r = outline.getBoundingClientRect()
        if (!within(r.top, r.bottom, 1)) {
          window.__paints.stray.push(`${outline.dataset.testid} at ${Math.round(r.top)}–${Math.round(r.bottom)}`)
        }
      }
      const canvas = document.querySelector('canvas.cwa\\:z-manager-focus')
      if (canvas?.width) {
        const alpha = canvas.getContext('2d').getImageData(x, 0, 1, canvas.height).data
        let start
        for (let y = 0; y <= canvas.height; y++) {
          const light = y < canvas.height && alpha[y * 4 + 3] === 0
          if (light && start === undefined) {
            start = y
          }
          if (!light && start !== undefined) {
            if (!within(start, y, cutout)) {
              window.__paints.stray.push(`page lightened at ${start}–${y}`)
            }
            start = undefined
          }
        }
      }
      if (window.__paints.frames < 45) {
        requestAnimationFrame(sample)
      }
    }
    requestAnimationFrame(sample)
  }, { from, to })
  await page.getByText(texts.pageAOther, { exact: true }).first().click()
  await eventually(() => page.evaluate(() => window.__paints.frames >= 45), 'Fewer than 45 frames were painted')
  const { stray } = await page.evaluate(() => window.__paints)
  assert(stray.length === 0, `Painted outside ${JSON.stringify(from)} and ${JSON.stringify(to)}: ${[...new Set(stray)].join(', ')}`)
  const outlines = await page.getByTestId('focus-outline').evaluateAll(els => els.map(el => el.getBoundingClientRect().top))
  assert(outlines.length === 1 && Math.abs(outlines[0] - to.top) <= 1, `The selection outline ended at ${JSON.stringify(outlines)}`)
})

test('67. with the group selected and Enable reordering on, a component dragged by its body shows one drop line and a ghost, moves nothing until the drop, PATCHes the group order once and survives a reload; with a component selected nothing is draggable', async ({ cwa: t }) => {
  const { page, settle } = t
  await openEditMode(t)
  await eventually(async () => await sourceAbove(page, texts.pageAOther) === true, 'The fixture order is wrong')
  const draggable = () => page.evaluate(() => ({ marked: document.querySelectorAll('[data-cwa-reorderable]').length, grips: document.querySelectorAll('[data-testid="reorder-grip"]').length }))

  await select(page, texts.pageAOther)
  await page.getByRole('tab', { name: 'Order', exact: true }).click()
  assert(await page.getByRole('switch', { name: 'Enable reordering' }).count() === 0, 'A component offers Enable reordering')
  await settle()
  assert(JSON.stringify(await draggable()) === JSON.stringify({ marked: 0, grips: 0 }), `With a component selected: ${JSON.stringify(await draggable())}`)

  const component = page.getByText(texts.pageAOther, { exact: true }).first()
  const box = await component.boundingBox()
  await component.click({ button: 'right', position: { x: 10, y: box.height / 2 } })
  const stack = page.getByTestId('resource-stack')
  await stack.waitFor()
  await stack.locator('[role="treeitem"][aria-label*="group" i] > [data-stack-name]').first().click()
  await stack.waitFor({ state: 'detached' })
  const toggle = page.getByRole('switch', { name: 'Enable reordering' })
  await toggle.waitFor()
  assert(await toggle.getAttribute('aria-checked') === 'false', 'Enable reordering starts on')
  await settle()
  assert((await draggable()).marked === 0, 'The group is draggable before Enable reordering is on')
  await toggle.click()
  await eventually(async () => JSON.stringify(await draggable()) === JSON.stringify({ marked: 2, grips: 2 }), `With the group selected and reordering on: ${JSON.stringify(await draggable())}`)
  assert(await page.evaluate(() => getComputedStyle(document.querySelector('[data-cwa-reorderable]')).cursor) === 'grab', 'A draggable component has no grab cursor')
  const grips = await page.getByTestId('reorder-grip').evaluateAll(els => els.map(el => ({ hidden: el.getAttribute('aria-hidden'), width: el.getBoundingClientRect().width, pointer: getComputedStyle(el).pointerEvents })))
  assert(grips.every(grip => grip.hidden === 'true' && grip.width <= 20 && grip.pointer === 'none'), `The grips are ${JSON.stringify(grips)}`)

  const [sourceBox] = await boxesOf(page, texts.source)
  const [otherBox] = await boxesOf(page, texts.pageAOther)
  const startX = otherBox.left + otherBox.width / 2
  const startY = otherBox.top + otherBox.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY - 10, { steps: 2 })
  await page.mouse.move(sourceBox.left + 20, sourceBox.top + 5, { steps: 8 })
  await page.getByTestId('reorder-drop-line').waitFor()
  assert(await page.getByTestId('reorder-drop-line').count() === 1, 'More than one drop line is drawn')
  assert(await page.getByTestId('reorder-ghost').isVisible(), 'No ghost follows the pointer')
  const [sourceDuring] = await boxesOf(page, texts.source)
  const [otherDuring] = await boxesOf(page, texts.pageAOther)
  assert(sourceDuring.top === sourceBox.top && otherDuring.top === otherBox.top, `The page moved before the drop: ${JSON.stringify({ sourceBox, sourceDuring, otherBox, otherDuring })}`)
  await page.mouse.up()
  assert(await sourceAbove(page, texts.pageAOther) === false, 'The screen did not move at once on the drop')
  const patch = await eventually(() => t.rehearsal.writes.find(w => w.method === 'PATCH' && w.path === `${t.seed.iris.pageAGroup}/order`), 'No PATCH to the group order')
  assert(JSON.stringify(patch.body.componentPositions) === JSON.stringify([t.seed.positions.aOther, t.seed.positions.aSource]), `PATCHed ${JSON.stringify(patch.body)}`)
  await settle()
  assert(t.rehearsal.writes.filter(w => w.path === `${t.seed.iris.pageAGroup}/order`).length === 1, 'The drop sent more than one order request')
  assert(await page.getByTestId('reorder-drop-line').count() === 0 && await page.getByTestId('reorder-ghost').count() === 0, 'The line or ghost stayed after the drop')
  assert(await toggle.getAttribute('aria-checked') === 'true', 'The drop changed the selection')
  assert(await sourceAbove(page, texts.pageAOther) === false, 'The order snapped back after the order response')
  await page.reload()
  await page.getByText(texts.pageAOther, { exact: true }).waitFor()
  await settle()
  assert(await sourceAbove(page, texts.pageAOther) === false, 'The new order did not persist')
})

test('70. a title save that fails once another component is selected raises a toast, which hides while the title is selected again; Retry saves it, and after a second failure Show me selects it with the bar showing the error (#461)', async ({ cwa: t }) => {
  const { page, seed } = t
  const first = (await t.api.create('/component/titles', { title: 'First title' }))['@id']
  const second = (await t.api.create('/component/titles', { title: 'Second title' }))['@id']
  await t.api.create('/_/component_positions', { componentGroup: seed.iris.pageAGroup, component: first })
  await t.api.create('/_/component_positions', { componentGroup: seed.iris.pageAGroup, component: second })
  await openEditMode(t)

  t.allowConsoleErrors(/^Failed to load resource: the server responded with a status of 500/)
  let refuse = false
  let held
  let release
  await page.route(url => url.pathname.startsWith(first), async (route) => {
    if (!refuse || route.request().method() !== 'PATCH') {
      return route.fallback()
    }
    refuse = false
    held = route.request().postDataJSON()
    await new Promise((resolve) => {
      release = resolve
    })
    return route.fulfill({ status: 500, contentType: 'application/ld+json', body: '{}' })
  })

  const status = page.getByTestId('bar-summary')
  async function failWhileSecondSelected(text) {
    refuse = true
    held = undefined
    await page.getByTestId('inline-edit-value').filter({ hasText: /^First title/ }).click()
    await page.getByPlaceholder('Add a title').fill(text)
    await eventually(() => held?.title === text, 'The title PATCH was never held')
    await page.getByTestId('inline-edit-value').filter({ hasText: 'Second title' }).click()
    await page.getByPlaceholder('Add a title').waitFor()
    release()
  }

  const toast = page.locator('[data-toast-id^="cwa-save-failed-"]')
  await failWhileSecondSelected('First title edited')
  await toast.waitFor()
  expect(await toast.getByTestId('toast-title').textContent()).toContain('Title wasn\'t saved')
  expect(await toast.getByTestId('toast-description').textContent()).toContain('Your last edit to Title wasn\'t saved.')
  expect((await toast.getByRole('button').allTextContents()).map(text => text.trim())).toEqual(expect.arrayContaining(['Show me', 'Retry', 'Reset']))
  assert(await status.getAttribute('data-state') !== 'error', 'The bar shows the failed save of a component it does not show')

  await page.getByTestId('inline-edit-value').filter({ hasText: /^First title/ }).click()
  await eventually(async () => await status.getAttribute('data-state') === 'error', 'Selecting the title did not show its failed save in the bar')
  await toast.waitFor({ state: 'detached' })
  await page.getByTestId('inline-edit-value').filter({ hasText: 'Second title' }).click()
  await toast.waitFor()

  await toast.getByRole('button', { name: 'Retry' }).click()
  await eventually(() => t.rehearsal.writes.find(w => w.method === 'PATCH' && w.path.startsWith(first) && w.body?.title === 'First title edited'), `Retry sent no PATCH: ${JSON.stringify(t.rehearsal.writes)}`)
  await toast.waitFor({ state: 'detached' })
  await t.settle()
  assert(await toast.count() === 0, 'The toast came back after Retry saved the title')

  await failWhileSecondSelected('First title edited again')
  await toast.waitFor()
  await toast.getByRole('button', { name: 'Show me' }).click()
  await eventually(async () => await status.getAttribute('data-state') === 'error', 'Show me did not select the title with its failed save')
  await toast.waitFor({ state: 'detached' })
})

test('71. typing in a live title on the page saves as it is typed, with no blur or Enter, and the bar\'s Title field shows each character as it is typed (#461)', async ({ cwa: t }) => {
  const { page, seed } = t
  const title = (await t.api.create('/component/titles', { title: 'Live title', publishedAt: 'now' }))['@id']
  await t.api.create('/_/component_positions', { componentGroup: seed.iris.pageAGroup, component: title })
  await openEditMode(t)

  await page.getByTestId('inline-edit-value').filter({ hasText: 'Live title' }).click()
  const input = page.getByPlaceholder('Add a title')
  await eventually(() => input.evaluate(el => document.activeElement === el), 'The title editor was not focused')
  const bar = managerPanel(page).getByRole('textbox', { name: 'Title' })
  await bar.waitFor()

  const patched = text => t.rehearsal.writes.find(w => w.method === 'PATCH' && w.body?.title === text)
  let typed = 'Live title'
  for (const words of [' typed', ' again']) {
    for (const key of words) {
      await page.keyboard.type(key)
      typed += key
      await eventually(async () => await bar.inputValue() === typed, `The bar does not show "${typed}" while it is typed on the page`)
    }
    await eventually(() => patched(typed), `Typing "${typed}" sent no PATCH: ${JSON.stringify(t.rehearsal.writes)}`)
    expect(await input.evaluate(el => document.activeElement === el)).toBe(true)
    expect(await input.inputValue()).toBe(typed)
  }
  await t.settle()
})

test('73. publishing an image that has no file shows the refusal on its file field and selects the Upload tab, without a toast or moving focus (#461)', async ({ cwa: t }) => {
  const { page, seed } = t
  const image = (await t.api.create('/component/images', {}))['@id']
  await t.api.create('/_/component_positions', { componentGroup: seed.iris.pageAGroup, component: image })
  await openEditMode(t)
  t.allowConsoleErrors(refusedResource)

  await page.getByRole('group', { name: 'Image component' }).click()
  await page.getByTestId('component-menu').waitFor()
  const tablist = page.getByRole('tablist')
  const upload = tablist.getByRole('tab', { name: /^Upload/ })
  await tablist.getByRole('tab', { name: 'Publish', exact: true }).click()
  assert(await upload.getAttribute('aria-selected') === 'false', 'The Upload tab was still selected')

  const publish = page.getByTestId('component-menu').getByRole('button', { name: /^Publish/ }).first()
  await publish.click()

  await eventually(() => t.rehearsal.writes.find(w => w.method === 'PATCH' && w.path.startsWith(image) && w.body?.publishedAt === 'now'), `Publish sent no PATCH: ${JSON.stringify(t.rehearsal.writes)}`)
  const line = page.locator('[data-cwa-field="file"] [data-testid="field-status-line"]')
  await eventually(async () => await line.getAttribute('data-line') === 'error', 'The file field does not show the refusal')
  assert(await upload.getAttribute('aria-selected') === 'true', 'The Upload tab holding the refused field was not selected')
  assert(await upload.getAttribute('data-badge') === 'error', 'The Upload tab has no error badge')
  await eventually(async () => await page.getByTestId('bar-summary').getAttribute('data-state') === 'error', 'The bar status does not show the refused field')
  assert(await publish.evaluate(el => el === document.activeElement), 'Showing the refused field moved focus off Publish')
  await t.settle()
  assert(await page.locator('[data-toast-id^="cwa-request-error-"]').count() === 0, 'The refusal was also raised as a toast')
})

async function collectionRoot(page) {
  const root = page.getByRole('group', { name: 'Collection component' })
  await root.waitFor()
  return root
}

test('74. in edit mode a Collection is outlined with a crosshair over its own area and selected by a click there, and a click on one of its item links opens the link menu with Edit Collection, which selects it (#461)', async ({ cwa: t }) => {
  const { page, settle } = t
  const seeded = await seedCollection(t.api, t.rehearsal.token, t.seed)
  await openEditMode(t)
  await page.getByText(collectionTexts.articleA, { exact: true }).waitFor()
  await settle()
  const root = await collectionRoot(page)
  await root.scrollIntoViewIfNeeded()
  await settle()
  const box = await root.boundingBox()
  const own = { x: box.x + 4, y: box.y + box.height - 3 }
  await page.mouse.move(own.x, own.y)
  const outline = await eventually(async () => {
    const [drawn] = await page.getByTestId('hover-outline').evaluateAll(els => els.map((el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, left: r.left, width: r.width, height: r.height }
    }))
    return drawn && covers(drawn, { top: box.y, left: box.x, width: box.width, height: box.height }) ? drawn : undefined
  }, 'No hover outline was drawn over the Collection')
  assert(outline.width <= box.width + 2, `The hover outline is wider than the Collection: ${JSON.stringify(outline)}`)
  const cursor = await page.evaluate(({ x, y }) => getComputedStyle(document.elementFromPoint(x, y)).cursor, own)
  assert(cursor === 'crosshair', `The cursor over the Collection is ${cursor}`)

  await page.mouse.click(own.x, own.y)
  await page.getByTestId('component-menu').waitFor()

  const selectedName = async () => (await page.getByTestId('path-selector-name').innerText()).trim()
  await eventually(async () => await selectedName() === 'Collection', 'A click on the Collection\'s own area did not select it')

  await select(page, texts.pageAOther)
  await eventually(async () => await selectedName() !== 'Collection', 'Selecting another component kept the Collection selected')
  await page.getByText(collectionTexts.articleB, { exact: true }).click()
  const menu = linkMenu(page)
  await menu.getByTestId('link-menu-edit').waitFor()
  const rows = await menu.getByRole('menuitem').allInnerTexts()
  assert(rows.length === 2 && rows[0] === 'Edit Collection' && rows[1] === `Visit ${seeded.paths.articleB}`, `The link menu lists ${JSON.stringify(rows)}`)
  await menu.getByTestId('link-menu-edit').click()
  await eventually(async () => await selectedName() === 'Collection', 'Edit Collection in the link menu did not select the Collection')
  assert(page.url().endsWith(t.seed.paths.home), `The item link navigated to ${page.url()}`)
})

test('75. a Collection\'s Data category shows the stored page data collection, and choosing another saves its IRI with the API path prefix and shows it after a reload (#461)', async ({ cwa: t }) => {
  const { page, settle } = t
  const seeded = await seedCollection(t.api, t.rehearsal.token, t.seed, { source: '/page_data/nested_page_datas' })
  const openCategory = async () => {
    await (await collectionRoot(page)).click({ position: { x: 4, y: 4 } })
    await page.getByTestId('component-menu').waitFor()
    await page.getByRole('tab', { name: 'Collection', exact: true }).click()
    const select = page.getByTestId('manager-tab-panel').getByRole('combobox', { name: 'Data category', exact: true })
    await select.waitFor()
    await settle()
    return select
  }
  await openEditMode(t)
  const select = await openCategory()
  assert((await select.innerText()).trim() === 'Nested Topics', `The Data category shows ${await select.innerText()}, not the stored Nested Topics`)

  await select.click()
  await page.getByRole('option', { name: 'Blog Articles', exact: true }).click()
  const write = await eventually(() => t.rehearsal.writes.find(w => w.method === 'PATCH' && w.path.startsWith(seeded.collection)), 'Choosing a Data category sent no PATCH')
  assert(JSON.stringify(write.body) === JSON.stringify({ resourceIri: `${apiPrefix}/page_data/blog_article_datas` }), `PATCHed ${JSON.stringify(write.body)}`)
  await settle()
  const stored = await t.api.get(seeded.collection)
  assert(stored.resourceIri === `${apiPrefix}/page_data/blog_article_datas`, `The API stored ${stored.resourceIri}`)

  await openEditMode(t)
  const reloaded = await openCategory()
  assert((await reloaded.innerText()).trim() === 'Blog Articles', `After a reload the Data category shows ${await reloaded.innerText()}`)
})

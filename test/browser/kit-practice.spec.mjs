import { expect, test } from '@playwright/test'

const kitBase = process.env.KIT_BASE

test.skip(!kitBase, 'Set KIT_BASE to a running playground, e.g. KIT_BASE=http://127.0.0.1:3417 pnpm run test:browser kit-practice.spec.mjs')

for (const width of [1280, 390]) {
  test(`in practice at ${width}: select, save, fail and retry, open the stack and page settings, with no console error`, async ({ page }) => {
    const errors = []
    page.on('console', message => message.type() === 'error' && !message.location().url.endsWith('/me') && errors.push(message.text()))
    page.on('pageerror', error => errors.push(String(error)))
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${kitBase}/kit?tab=practice`)

    const status = page.getByTestId('kit-practice-status')
    await expect(status).toContainText('Selected: Title')
    const chrome = page.getByTestId('kit-practice-chrome')
    const title = chrome.getByRole('textbox', { name: 'Title' })
    await expect(title).toHaveValue('Shaker kitchens, built by hand')

    await title.click()
    await title.pressSequentially(' now')
    await expect(chrome.getByText('All changes saved').first()).toBeVisible()
    await expect(page.locator('[data-kit-practice="main"] h1').first()).toContainText('now')

    await page.getByTestId('kit-practice-next').click()
    await page.getByRole('option', { name: '500 server error' }).click()
    await expect(status).toContainText('the next save fails: 500 server error')
    await title.click()
    await title.pressSequentially('!')
    await title.hover()
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(chrome.getByText('All changes saved').first()).toBeVisible()

    const body = page.locator('[data-kit-practice="main"] p').first()
    await body.scrollIntoViewIfNeeded()
    await body.click({ button: 'right' })
    await expect(page.getByRole('treeitem', { name: 'Body Text' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('treeitem', { name: 'Body Text' })).toHaveCount(0)

    await page.getByTestId('kit-practice-settings').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('textbox', { name: 'Reference' })).toHaveValue('Kit practice')
    await dialog.getByRole('button', { name: 'Close' }).first().click()
    await expect(dialog).toHaveCount(0)
    await expect(status).toContainText('Not editing')

    expect(errors).toEqual([])
  })
}

for (const path of ['bar', 'page']) {
  test(`in practice: a 500 saving the selected component from the ${path} shows in its field and outline, never as a toast (#461)`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${kitBase}/kit?tab=practice`)
    const status = page.getByTestId('kit-practice-status')
    await expect(status).toContainText('Selected: Title')
    const chrome = page.getByTestId('kit-practice-chrome')

    await page.getByTestId('kit-practice-next').click()
    await page.getByRole('option', { name: '500 server error' }).click()
    await expect(status).toContainText('the next save fails: 500 server error')

    if (path === 'bar') {
      const title = chrome.getByRole('textbox', { name: 'Title' })
      await title.click()
      await title.pressSequentially('!')
    }
    else {
      const heading = page.locator('[data-kit-practice="main"] h1').first()
      await heading.getByTestId('inline-edit-value').click()
      const input = heading.getByRole('textbox', { name: 'Title' })
      await expect(input).toBeFocused()
      await input.pressSequentially('!')
      await input.press('Enter')
    }

    await expect(page.locator('[data-testid="focus-outline"][data-save="error"]').first()).toBeVisible()
    await expect(chrome.getByText(/not saved/).first()).toBeVisible()
    await expect(page.getByText('Oops! There was a problem.')).toHaveCount(0)
    await expect(page.getByText('Edit the shared layout?')).toHaveCount(0)
  })
}

test('in practice at 1280×600: switching the page dialog to a nested child page never scrolls to its Parent page, and choosing A page still does (#461)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 })
  await page.goto(`${kitBase}/kit?tab=practice`)
  await expect(page.getByTestId('kit-practice-status')).toContainText('Selected: Title')
  const dialog = page.getByRole('dialog')
  await page.getByTestId('kit-practice-settings').click()
  await expect(dialog.getByRole('textbox', { name: 'Reference' })).toHaveValue('Kit practice')

  const depths = dialog.getByTestId('page-depths')
  const nesting = dialog.getByRole('group', { name: 'Nested under' })
  const parentPage = dialog.locator('[data-cwa-reveal] > *').filter({ hasText: 'Parent page' })
  const scroller = nesting.locator('xpath=ancestor::*[@data-cwa-scroll][1]')
  const placeNestingAtBottom = () => nesting.evaluate((group) => {
    const body = group.closest('[data-cwa-scroll]')
    body.scrollTop += group.getBoundingClientRect().bottom - (body.getBoundingClientRect().top + body.clientHeight)
    return Math.abs(group.getBoundingClientRect().bottom - (body.getBoundingClientRect().top + body.clientHeight)) < 2
  })
  const scrollTopOverFrames = () => scroller.evaluate(body => new Promise((resolve) => {
    const seen = new Set()
    let frames = 20
    const step = () => {
      seen.add(body.scrollTop)
      --frames ? requestAnimationFrame(step) : resolve([...seen])
    }
    requestAnimationFrame(step)
  }))
  const inView = element => element.evaluate((field) => {
    const body = field.closest('[data-cwa-scroll]')
    const view = body.getBoundingClientRect()
    const box = field.getBoundingClientRect()
    return box.top >= view.top - 1 && box.bottom <= view.top + body.clientHeight + 1
  })
  const choose = async (group, label) => {
    const option = group.getByRole('button', { name: label, exact: true })
    await expect(async () => {
      await option.focus()
      await page.keyboard.press('Enter')
      await expect(option).toHaveAttribute('aria-pressed', 'true', { timeout: 500 })
    }).toPass()
    return option
  }

  await choose(depths, 'Kit practice parent')
  await expect(dialog.getByRole('textbox', { name: 'Reference' })).toHaveValue('Kit practice parent')
  await expect(parentPage).toHaveCount(0)
  expect(await placeNestingAtBottom()).toBe(true)
  const before = await scroller.evaluate(body => body.scrollTop)

  await page.getByTestId('page-depths').getByRole('button', { name: 'Kit practice', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: 'Reference' })).toHaveValue('Kit practice')
  await expect(parentPage).toHaveCount(1)
  expect(await scrollTopOverFrames()).toEqual([before])
  expect(await inView(parentPage)).toBe(false)

  await choose(nesting, 'Nothing')
  await expect(parentPage).toHaveCount(0)
  expect(await placeNestingAtBottom()).toBe(true)
  const option = await choose(nesting, 'A page')
  await expect.poll(() => inView(parentPage)).toBe(true)
  await expect(option).toBeFocused()
})

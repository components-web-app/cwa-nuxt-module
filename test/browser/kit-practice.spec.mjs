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
      await heading.getByTestId('inline-edit-value').focus()
      await page.keyboard.press('Enter')
      const input = heading.getByRole('textbox', { name: 'Title' })
      await input.pressSequentially('!')
      await input.press('Enter')
    }

    await expect(page.locator('[data-testid="focus-outline"][data-save="error"]').first()).toBeVisible()
    await expect(chrome.getByText(/not saved/).first()).toBeVisible()
    await expect(page.getByText('Oops! There was a problem.')).toHaveCount(0)
  })
}

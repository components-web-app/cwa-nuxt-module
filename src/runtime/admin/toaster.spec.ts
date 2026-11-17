// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { mountToaster } from '#cwa/admin/toaster'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('mountToaster (#457)', () => {
  test('mounts the toaster in the app\'s own container and returns its show and dismiss', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const app = createApp({ render: () => null })
    app.mount(container)

    const toaster = mountToaster(app)
    toaster.show({ id: 'a', tone: 'success', title: 'Published' })
    await nextTick()

    expect(container.querySelector('[data-testid="toaster"]')).not.toBeNull()
    expect(container.querySelector('[data-toast-id="a"]')?.textContent).toContain('Published')

    toaster.dismiss('a')
    await vi.waitFor(() => expect(container.querySelector('[data-toast-id="a"]')).toBeNull())
  })

  test('falls back to the body when the app has no container', () => {
    mountToaster(createApp({ render: () => null }))

    expect(document.body.querySelector(':scope > div [data-testid="toaster"]')).not.toBeNull()
  })
})

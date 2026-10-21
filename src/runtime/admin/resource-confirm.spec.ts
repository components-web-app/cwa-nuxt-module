import { describe, expect, test, vi } from 'vitest'
import { createApp } from 'vue'
import { createConfirmDialog } from 'vuejs-confirm-dialog'
import { confirmResourceAction } from './resource-confirm'

const reveal = vi.hoisted(() => vi.fn())
vi.mock('vuejs-confirm-dialog', () => ({
  install: vi.fn(),
  createConfirmDialog: vi.fn(() => ({ reveal })),
}))
vi.mock('#cwa/templates/components/core/ConfirmDialog.vue', () => ({ default: { name: 'ConfirmDialog' } }))

describe('confirmResourceAction: the resource manager\'s prompts, loaded only when asked (#429)', () => {
  test.each([
    { action: 'delete' as const, title: 'Delete this resource?', content: '<p>Are you sure you want to permanently delete this resource?</p>' },
    { action: 'discard' as const, title: 'Discard new resource?', content: '<p>Are you sure you want to discard your new resource. It will NOT be saved.</p>' },
  ])('$action asks with ConfirmDialog and is confirmed unless cancelled', async ({ action, title, content }) => {
    reveal.mockResolvedValueOnce({ isCanceled: false }).mockResolvedValueOnce({ isCanceled: true })
    const app = createApp({})

    expect(await confirmResourceAction(app, action)).toBe(true)
    expect(await confirmResourceAction(app, action)).toBe(false)
    expect(createConfirmDialog).toHaveBeenCalledWith({ name: 'ConfirmDialog' })
    expect(reveal).toHaveBeenCalledWith({ title, content })
  })
  test('any other prompt is asked as given', async () => {
    reveal.mockResolvedValueOnce({ isCanceled: true })

    expect(await confirmResourceAction(createApp({}), { title: 't', content: 'c' })).toBe(false)
    expect(reveal).toHaveBeenCalledWith({ title: 't', content: 'c' })
  })
})

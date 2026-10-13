import { describe, expect, test, vi } from 'vitest'
import { createApp, defineComponent } from 'vue'
import { createConfirmDialog } from './confirm-dialog'

const library = vi.hoisted(() => ({ loads: 0 }))

vi.mock('vuejs-confirm-dialog', () => {
  library.loads++
  return {
    install: vi.fn(),
    createConfirmDialog: vi.fn(() => ({ reveal: vi.fn() })),
  }
})

const Dialog = defineComponent({ render: () => null })

describe('createConfirmDialog', () => {
  test('does not load the dialog library until a dialog is created, so visitors never download it (#382)', async () => {
    expect(library.loads).toBe(0)
    await createConfirmDialog(createApp({}), Dialog)
    expect(library.loads).toBe(1)
  })

  test('installs the library with the app before creating the dialog, so the dialog renders with the app\'s context', async () => {
    const { install, createConfirmDialog: createLibraryDialog } = await import('vuejs-confirm-dialog')
    const app = createApp({})
    const dialog = await createConfirmDialog(app, Dialog)
    expect(install).toHaveBeenCalledWith(app)
    expect(createLibraryDialog).toHaveBeenCalledWith(Dialog)
    expect(vi.mocked(install).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(createLibraryDialog).mock.invocationCallOrder[0])
    expect(dialog).toBe(vi.mocked(createLibraryDialog).mock.results[0].value)
  })

  test('installs the library once per app however many dialogs are created', async () => {
    const { install, createConfirmDialog: createLibraryDialog } = await import('vuejs-confirm-dialog')
    const app = createApp({})
    await createConfirmDialog(app, Dialog)
    await createConfirmDialog(app, Dialog)
    expect(install).toHaveBeenCalledOnce()
    expect(createLibraryDialog).toHaveBeenCalledTimes(2)
  })
})

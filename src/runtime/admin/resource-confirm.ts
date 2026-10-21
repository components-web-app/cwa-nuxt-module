import type { App } from 'vue'
import { createConfirmDialog } from './confirm-dialog'

const confirmations = {
  delete: {
    title: 'Delete this resource?',
    content: '<p>Are you sure you want to permanently delete this resource?</p>',
  },
  discard: {
    title: 'Discard new resource?',
    content: '<p>Are you sure you want to discard your new resource. It will NOT be saved.</p>',
  },
}

export async function confirmResourceAction(app: App, action: keyof typeof confirmations | { title: string, content: string }) {
  const { default: ConfirmDialog } = await import('#cwa/templates/components/core/ConfirmDialog.vue')
  const dialog = await createConfirmDialog(app, ConfirmDialog)
  const { isCanceled } = await dialog.reveal(typeof action === 'string' ? confirmations[action] : action)
  return !isCanceled
}

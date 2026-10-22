import type { App } from 'vue'
import { createConfirmDialog } from './confirm-dialog'
import type Cwa from '#cwa/cwa'
import { realtimeView } from '#cwa/resources/realtime-view'

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

export async function editingNotice($cwa: Cwa, iri: string) {
  const peers = ((await realtimeView($cwa).load())?.peers(iri) ?? []).filter(peer => !peer.idle)
  const names = [...new Map(peers.map(peer => [peer.user.id, peer.isSelf ? 'You (other window)' : peer.user.name || 'Someone'])).values()]
  if (!names.length) {
    return
  }
  if (names.length === 1) {
    return `${names[0]} is editing this.`
  }
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)} are editing this.`
}

export async function confirmResourceAction(app: App, action: keyof typeof confirmations | { title: string, content: string }, iri?: string) {
  const { default: ConfirmDialog } = await import('#cwa/templates/components/core/ConfirmDialog.vue')
  const dialog = await createConfirmDialog(app, ConfirmDialog)
  const $cwa = iri ? app.config.globalProperties.$cwa as Cwa | undefined : undefined
  const notice = iri && $cwa ? await editingNotice($cwa, iri) : undefined
  const { isCanceled } = await dialog.reveal({ ...(typeof action === 'string' ? confirmations[action] : action), notice })
  return !isCanceled
}

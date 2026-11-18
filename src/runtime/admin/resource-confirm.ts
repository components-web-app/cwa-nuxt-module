import type { App } from 'vue'
import { createConfirmDialog } from './confirm-dialog'
import type Cwa from '#cwa/cwa'
import type { CwaConfirmOptions } from '#cwa/composables/cwa-confirm'
import { realtimeView } from '#cwa/resources/realtime-view'

export interface ConfirmChoiceOptions extends CwaConfirmOptions {
  extra?: string
}

const confirmations: Record<'delete' | 'discard', CwaConfirmOptions> = {
  delete: {
    title: 'Delete this resource?',
    description: 'This can\'t be undone.',
    keep: 'Don\'t delete',
    go: 'Delete',
  },
  discard: {
    title: 'Discard this new component?',
    description: 'It hasn\'t been saved.',
    keep: 'Keep editing',
    go: 'Discard',
  },
}

export async function editingNotice($cwa: Cwa, iri: string) {
  const peers = ((await realtimeView($cwa).load())?.peers(iri) ?? []).filter(peer => !peer.idle)
  const names = [...new Map(peers.map(peer => [peer.user.id, peer.name])).values()]
  if (!names.length) {
    return
  }
  if (names.length === 1) {
    return `${names[0]} is editing this.`
  }
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)} are editing this.`
}

export async function confirmChoice(app: App, options: ConfirmChoiceOptions): Promise<'go' | 'extra' | undefined> {
  const { default: Confirm } = await import('#cwa/templates/components/core/ui/Confirm.vue')
  const dialog = await createConfirmDialog(app, Confirm)
  const { isCanceled, data } = await dialog.reveal({ ...options })
  if (isCanceled) {
    return
  }
  return data === 'extra' ? 'extra' : 'go'
}

export async function confirmResourceAction(app: App, action: keyof typeof confirmations | CwaConfirmOptions, iri?: string) {
  const $cwa = iri ? app.config.globalProperties.$cwa as Cwa | undefined : undefined
  const notice = iri && $cwa ? await editingNotice($cwa, iri) : undefined
  const options = typeof action === 'string' ? confirmations[action] : action
  return !!await confirmChoice(app, notice ? { ...options, lines: [{ text: notice }, ...(options.lines ?? [])] } : options)
}

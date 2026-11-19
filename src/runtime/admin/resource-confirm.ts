import type { App } from 'vue'
import { createConfirmDialog } from './confirm-dialog'
import type Cwa from '#cwa/cwa'
import type { CwaConfirmOptions } from '#cwa/composables/cwa-confirm'
import type { ButtonTone } from '#cwa/templates/components/ui/kit-looks'
import { realtimeView } from '#cwa/resources/realtime-view'

export interface ConfirmChoiceOptions extends CwaConfirmOptions {
  extra?: string
  extraTone?: ButtonTone
  alternative?: string
  alternativeTone?: ButtonTone
}

const discardDraft: CwaConfirmOptions = {
  title: 'Discard the unpublished changes?',
  description: 'The live version stays as it is.',
  keep: 'Keep changes',
  go: 'Discard changes',
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

export async function confirmChoice(app: App, options: ConfirmChoiceOptions): Promise<'go' | 'extra' | 'alternative' | undefined> {
  const { default: Confirm } = await import('#cwa/templates/components/core/ui/Confirm.vue')
  const dialog = await createConfirmDialog(app, Confirm)
  const { isCanceled, data } = await dialog.reveal({ ...options })
  if (isCanceled) {
    return
  }
  return data === 'extra' || data === 'alternative' ? data : 'go'
}

export async function confirmResourceAction(app: App, action: keyof typeof confirmations | CwaConfirmOptions, iri?: string) {
  const $cwa = iri ? app.config.globalProperties.$cwa as Cwa | undefined : undefined
  const notice = iri && $cwa ? await editingNotice($cwa, iri) : undefined
  const data = action === 'delete' && iri ? $cwa?.resources?.getResource(iri).value?.data : undefined
  const isDraftOfLive = data?._metadata?.publishable?.published === false && !!data.publishedResource
  const options = isDraftOfLive ? discardDraft : typeof action === 'string' ? confirmations[action] : action
  return !!await confirmChoice(app, notice ? { ...options, lines: [{ text: notice }, ...(options.lines ?? [])] } : options)
}

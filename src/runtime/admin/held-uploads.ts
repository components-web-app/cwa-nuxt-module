import { shallowReactive } from 'vue'
import type Cwa from '#cwa/cwa'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { writeFieldStates } from '#cwa/resources/field-state-writer'

export interface HeldUpload {
  file: File
  url?: string
  adding?: unknown
}

const heldByCwa = new WeakMap<Cwa, Map<string, HeldUpload>>()

function heldOf($cwa: Cwa) {
  let held = heldByCwa.get($cwa)
  if (!held) {
    held = shallowReactive(new Map<string, HeldUpload>())
    heldByCwa.set($cwa, held)
  }
  return held
}

const keyOf = (iri: string, field: string) => `${iri}\u0000${field}`

function addingOf($cwa: Cwa, iri: string) {
  return $cwa.resources.getResource(iri).value?.data?._metadata?.adding
}

export function releaseUpload($cwa: Cwa, iri: string, field: string) {
  const held = heldOf($cwa)
  const url = held.get(keyOf(iri, field))?.url
  url && URL.revokeObjectURL?.(url)
  held.delete(keyOf(iri, field))
}

export function holdUpload($cwa: Cwa, iri: string, field: string, file: File) {
  releaseUpload($cwa, iri, field)
  heldOf($cwa).set(keyOf(iri, field), { file, url: URL.createObjectURL?.(file), adding: addingOf($cwa, iri) })
}

export function heldUpload($cwa: Cwa, iri: string, field: string): HeldUpload | undefined {
  const held = heldOf($cwa).get(keyOf(iri, field))
  return held && held.adding === addingOf($cwa, iri) ? held : undefined
}

export function heldFields($cwa: Cwa, iri: string) {
  const prefix = keyOf(iri, '')
  return [...heldOf($cwa).keys()]
    .filter(key => key.startsWith(prefix))
    .map(key => key.slice(prefix.length))
    .filter(field => !!heldUpload($cwa, iri, field))
}

export function moveHeldUploads($cwa: Cwa, from: string, to: string) {
  const held = heldOf($cwa)
  for (const field of heldFields($cwa, from)) {
    const upload = held.get(keyOf(from, field))!
    held.delete(keyOf(from, field))
    held.set(keyOf(to, field), { ...upload, adding: undefined })
  }
}

export function fieldStateReporter($cwa: Cwa, field: string) {
  return (sentTo: string, done?: Promise<{ resource?: CwaResource, error?: any }>) => {
    const sending = $cwa.resources.getResource(sentTo).value
    if (!done) {
      return
    }
    writeFieldStates(states => states.started(sending, [field]))
    done.then(({ resource: answer, error }) => writeFieldStates(states => states.settled(sending, [field], answer, error, at => $cwa.resources.getResource(at).value)))
  }
}

export async function sendUpload($cwa: Cwa, iri: string, field: string, file: File, endpoint = `${iri}/upload`) {
  const formData = new FormData()
  formData.append(field, file)
  const resource = await $cwa.resourcesManager.updateResource({
    iri,
    endpoint,
    data: formData,
    headers: {
      accept: '*/*',
    },
    onRequest: fieldStateReporter($cwa, field),
  })
  return !!resource
}

export async function sendHeldUpload($cwa: Cwa, iri: string, field: string, endpoint?: string) {
  const held = heldUpload($cwa, iri, field)
  if (!held) {
    return true
  }
  const sent = await sendUpload($cwa, iri, field, held.file, endpoint)
  sent && releaseUpload($cwa, iri, field)
  return sent
}

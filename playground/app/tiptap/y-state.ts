import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { encodeUpdate } from './y-sync'

const PATH = '/_/collaboration_states'

export type CollaborationStateFetch = (url: string, options?: Record<string, any>) => Promise<any>

export interface StoredCollaborationState {
  state: string
  htmlHash: string
}

interface StateItem extends StoredCollaborationState {
  '@id': string
  '_metadata': { version: number }
}

export interface CollaborationStateOptions {
  iri: () => string
  field: string
  encode: () => Uint8Array
}

export function htmlHash(html: string | null | undefined) {
  let h1 = 0xDEADBEEF
  let h2 = 0x41C6CE57
  for (const char of html || '') {
    const code = char.codePointAt(0)!
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `c53:${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`
}

function status(error: unknown) {
  return (error as { response?: { status?: number } }).response?.status
}

export function createCollaborationState(fetch: CollaborationStateFetch, { iri, field, encode }: CollaborationStateOptions) {
  let known: { id: string, version: number } | undefined
  let looked = false
  let writing: Promise<void> | undefined
  let next: { html: string | null | undefined } | undefined

  function query() {
    const resource = iri()
    return { [getResourceTypeFromIri(resource) === CwaResourceTypes.PAGE_DATA ? 'pageData' : 'component']: resource, field }
  }

  function remember(item: StateItem | undefined) {
    known = item ? { id: item['@id'], version: item._metadata.version } : undefined
  }

  async function lookUp() {
    const found: StateItem | undefined = (await fetch(PATH, { query: query() }))?.member?.[0]
    looked = true
    remember(found)
    return found
  }

  async function write(html: string | null | undefined, retry: boolean): Promise<void> {
    const body = { state: encodeUpdate(encode()), htmlHash: htmlHash(html) }
    try {
      remember(known
        ? await fetch(known.id, { method: 'PATCH', headers: { 'content-type': 'application/merge-patch+json', 'if-match': `"${known.version}"` }, body })
        : await fetch(PATH, { method: 'POST', headers: { 'content-type': 'application/ld+json' }, body: { ...query(), ...body } }))
    }
    catch (error) {
      const code = status(error)
      if (code === 412) {
        remember((error as { data?: StateItem }).data)
      }
      else if (code === 422 && !known) {
        await lookUp().catch(() => undefined)
      }
      else {
        return
      }
      if (retry && known) {
        await write(html, false)
      }
    }
  }

  async function drain() {
    while (next) {
      const { html } = next
      next = undefined
      if (!looked) {
        await lookUp().catch(() => undefined)
      }
      await write(html, true)
    }
    writing = undefined
  }

  return {
    async load(): Promise<StoredCollaborationState | undefined> {
      try {
        const found = await lookUp()
        return found && { state: found.state, htmlHash: found.htmlHash }
      }
      catch (error) {
        console.warn(`The collaboration state for "${field}" could not be loaded (${status(error) ?? 'no response'}), so the editor starts from the saved HTML. Co-editing stores it from api-components-bundle 2.0.0-alpha.37.`)
        return undefined
      }
    },
    save(html: string | null | undefined) {
      next = { html }
      writing ??= drain()
      return writing
    },
  }
}

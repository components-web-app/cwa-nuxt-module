/**
 * #246 — Replay layer for deterministic integration tests.
 *
 * A drop-in stand-in for `CwaFetch` that serves responses from a recorded cassette (see
 * `test/cassettes/record.mjs`) instead of hitting the network. Only `fetch.raw(url)` is used by the
 * pipeline, so that's what we implement faithfully — including throwing an ofetch-shaped error for
 * non-2xx entries.
 *
 * The key feature is CONTROLLABLE TIMING: in `manual` mode a request does not resolve until the test
 * releases it, so navigations can be interleaved deterministically to reproduce timing races (the
 * "switch before load / stuck page" class of bug the unit harness structurally can't catch).
 */

export interface CassetteEntry {
  method: string
  path: string
  status: number
  body: any
  headers: Record<string, string>
}

export interface Cassette {
  name: string
  entries: CassetteEntry[]
}

function replayHeaders(headers: Record<string, string>) {
  const lower: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers || {})) {
    lower[k.toLowerCase()] = v
  }
  return {
    get: (key: string) => lower[key.toLowerCase()] ?? null,
    getSetCookie: () => [] as string[],
  }
}

function makeFetchError(status: number, message: string, headers: Record<string, string>) {
  // shape mirrors ofetch's FetchError as read by createCwaResourceError
  const error = new Error(message) as Error & { statusCode: number, statusMessage: string, response: unknown }
  error.statusCode = status
  error.statusMessage = message
  error.response = { status, _data: undefined, headers: replayHeaders(headers) }
  return error
}

interface Pending {
  path: string
  settle: () => void
}

export class ReplayCwaFetch {
  private readonly byPath = new Map<string, CassetteEntry[]>()
  private readonly cursor = new Map<string, number>()
  private readonly manual: boolean
  private queue: Pending[] = []

  /** every request path issued to the fetch, in order — useful for assertions ("was /_/routes// requested?") */
  public readonly requestLog: string[] = []
  /** callable + `.raw`, matching the shape of CwaFetch.fetch that the pipeline uses */
  public readonly fetch: ((url: string) => Promise<unknown>) & { raw: (url: string) => Promise<unknown> }

  constructor(cassette: Cassette, opts: { manual?: boolean } = {}) {
    this.manual = !!opts.manual
    for (const entry of cassette.entries) {
      const arr = this.byPath.get(entry.path) || []
      arr.push(entry)
      this.byPath.set(entry.path, arr)
    }
    const raw = (url: string) => this.request(url)
    const call = (url: string) => this.request(url).then((r: any) => r?._data)
    this.fetch = Object.assign(call, { raw })
  }

  private entryFor(path: string): CassetteEntry | undefined {
    const arr = this.byPath.get(path)
    if (!arr) {
      return undefined
    }
    // recordings are deduped (one entry per path); repeated GETs return the same entry
    const index = Math.min(this.cursor.get(path) ?? 0, arr.length - 1)
    this.cursor.set(path, index + 1)
    return arr[index]
  }

  private request(url: string): Promise<unknown> {
    const path = url.split('?')[0] ?? url
    this.requestLog.push(path)
    const entry = this.entryFor(path)
    const produce = () => {
      if (!entry) {
        throw makeFetchError(404, `No cassette entry for ${path}`, {})
      }
      if (entry.status >= 200 && entry.status < 300) {
        return { _data: entry.body, headers: replayHeaders(entry.headers), status: entry.status }
      }
      throw makeFetchError(entry.status, entry.body?.['hydra:description'] || `HTTP ${entry.status}`, entry.headers)
    }
    if (!this.manual) {
      return Promise.resolve().then(produce)
    }
    return new Promise((resolve, reject) => {
      this.queue.push({
        path,
        settle: () => {
          try {
            resolve(produce())
          }
          catch (error) {
            reject(error)
          }
        },
      })
    })
  }

  // ---- timing control (manual mode) --------------------------------------

  /** paths currently awaiting release */
  public pending(): string[] {
    return this.queue.map(q => q.path)
  }

  /** release (resolve) every pending request whose path matches; returns how many were released */
  public release(match: string | ((path: string) => boolean)): number {
    const predicate = typeof match === 'function' ? match : (path: string) => path === match
    const releasing = this.queue.filter(q => predicate(q.path))
    this.queue = this.queue.filter(q => !predicate(q.path))
    releasing.forEach(q => q.settle())
    return releasing.length
  }

  /** release everything currently pending (requests queued during release go to the next batch) */
  public releaseAll(): number {
    const releasing = this.queue
    this.queue = []
    releasing.forEach(q => q.settle())
    return releasing.length
  }

  public getRequestOptions() {
    return { method: 'GET' as const, headers: {} }
  }
}

/** let queued microtasks (promise chains in the pipeline) run to completion */
export async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve()
  }
}

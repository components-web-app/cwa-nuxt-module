export interface ChannelOptions {
  gapMs?: number
  postMs?: number
  deliverMs?: number
  maxBytes?: number
  drop?: (from: string, to: string, data: unknown) => boolean
}

export interface ChannelTab<Data> {
  send: (data: Data) => boolean
  on: (handler: (clientId: string, data: Data) => void) => void
}

export function createCoalescingChannel<Data>({ gapMs = 125, postMs = 40, deliverMs = 30, maxBytes = 16_384, drop }: ChannelOptions = {}) {
  const handlers = new Map<string, (clientId: string, data: Data) => void>()
  const stats = { posts: 0, refused: 0, largestBody: 0, bodies: [] as number[], senders: [] as string[] }

  function tab(clientId: string): ChannelTab<Data> {
    let waiting: { data: Data } | undefined
    let inFlight = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let lastSent = Number.NEGATIVE_INFINITY

    function schedule() {
      if (inFlight || timer || !waiting) {
        return
      }
      timer = setTimeout(post, Math.max(lastSent + gapMs - Date.now(), 0))
    }

    function post() {
      timer = undefined
      const outgoing = waiting
      if (!outgoing) {
        return
      }
      waiting = undefined
      inFlight = true
      lastSent = Date.now()
      const body = JSON.stringify({ clientId: `00000000-0000-4000-8000-${clientId.padStart(12, '0').slice(-12)}`, event: 'yjs:html', iri: '/_api/component/html_contents/01234567-89ab-cdef-0123-456789abcdef', data: outgoing.data })
      stats.posts++
      stats.bodies.push(body.length)
      stats.senders.push(clientId)
      stats.largestBody = Math.max(stats.largestBody, body.length)
      const refused = body.length > maxBytes
      refused && stats.refused++
      setTimeout(() => {
        inFlight = false
        if (refused) {
          schedule()
          return
        }
        const published = JSON.parse(body).data as Data
        setTimeout(() => {
          for (const [to, handler] of handlers) {
            to !== clientId && !drop?.(clientId, to, published) && handler(clientId, published)
          }
        }, deliverMs)
        schedule()
      }, postMs)
    }

    return {
      send: (data) => {
        waiting = { data }
        schedule()
        return true
      },
      on: (handler) => {
        handlers.set(clientId, handler)
      },
    }
  }

  return { tab, stats }
}

export interface ChannelOptions {
  gapMs?: number
  postMs?: number
  deliverMs?: number
  drop?: (from: string, to: string, data: unknown) => boolean
}

export interface ChannelTab<Data> {
  send: (data: Data) => boolean
  on: (handler: (clientId: string, data: Data) => void) => void
}

export function createCoalescingChannel<Data>({ gapMs = 125, postMs = 40, deliverMs = 30, drop }: ChannelOptions = {}) {
  const handlers = new Map<string, (clientId: string, data: Data) => void>()
  const stats = { posts: 0, largestBody: 0, bodies: [] as number[], senders: [] as string[] }

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
      const body = JSON.stringify({ clientId, event: 'yjs', iri: '/component/html_contents/1', data: outgoing.data })
      stats.posts++
      stats.bodies.push(body.length)
      stats.senders.push(clientId)
      stats.largestBody = Math.max(stats.largestBody, body.length)
      setTimeout(() => {
        inFlight = false
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

import { vi } from 'vitest'

export class FakeEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2

  readyState = FakeEventSource.CONNECTING
  readonly withCredentials: boolean
  onopen: ((event: Event) => unknown) | null = null
  onmessage: ((event: MessageEvent) => unknown) | null = null
  onerror: ((event: Event) => unknown) | null = null

  constructor(readonly url: string, init: EventSourceInit = {}, private readonly registry: FakeEventSource[] = []) {
    this.withCredentials = !!init.withCredentials
    registry.push(this)
  }

  open() {
    this.readyState = FakeEventSource.OPEN
    this.onopen?.(new Event('open'))
  }

  fail() {
    this.readyState = FakeEventSource.CONNECTING
    this.onerror?.(new Event('error'))
  }

  close() {
    this.readyState = FakeEventSource.CLOSED
  }

  deliver(data: unknown, { lastEventId = '' }: { lastEventId?: string } = {}) {
    return this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data), lastEventId }))
  }
}

export function installFakeEventSource() {
  const instances: FakeEventSource[] = []
  vi.stubGlobal('EventSource', class extends FakeEventSource {
    constructor(url: string | URL, init?: EventSourceInit) {
      super(String(url), init, instances)
    }
  })

  function latest() {
    const source = instances.at(-1)
    if (!source) {
      throw new Error('No EventSource has been created')
    }
    return source
  }

  return {
    instances,
    latest,
    deliver(data: unknown, options?: { lastEventId?: string }) {
      const source = instances.at(-1)
      if (!source || source.readyState === FakeEventSource.CLOSED) {
        throw new Error('No EventSource is open to deliver to')
      }
      return source.deliver(data, options)
    },
  }
}

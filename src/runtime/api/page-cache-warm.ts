export interface PageCacheWarmProgress {
  completed: number
  total: number
}

export interface PageCacheWarmFailure {
  path: string
  status: number
  error?: 'timeout' | 'network'
  location?: string
  detail?: string
}

export interface PageCacheWarmSummary {
  total: number
  warmed: number
  failed: PageCacheWarmFailure[]
}

type WarmLine
  = | { type: 'start', total: number }
    | { type: 'page', completed: number, total: number }
    | ({ type: 'done' } & PageCacheWarmSummary)

export class PageCacheWarmInterruptedError extends Error {
  constructor(public readonly progress: PageCacheWarmProgress) {
    super('The page cache warm stopped before it finished')
  }
}

export async function readWarmStream(stream: ReadableStream<Uint8Array>, onProgress: (progress: PageCacheWarmProgress) => void): Promise<PageCacheWarmSummary> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let progress: PageCacheWarmProgress = { completed: 0, total: 0 }
  let buffer = ''

  const handle = (line: WarmLine): PageCacheWarmSummary | undefined => {
    if (line.type === 'done') {
      return { total: line.total, warmed: line.warmed, failed: line.failed }
    }
    progress = { completed: line.type === 'page' ? line.completed : 0, total: line.total }
    onProgress(progress)
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let index
      while ((index = buffer.indexOf('\n')) >= 0) {
        const text = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        const summary = text ? handle(JSON.parse(text) as WarmLine) : undefined
        if (summary) {
          return summary
        }
      }
      if (done) {
        break
      }
    }
  }
  catch {
    throw new PageCacheWarmInterruptedError(progress)
  }
  throw new PageCacheWarmInterruptedError(progress)
}

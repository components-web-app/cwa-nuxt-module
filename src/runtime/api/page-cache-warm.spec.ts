// @vitest-environment node

import { describe, expect, test, vi } from 'vitest'
import { PageCacheWarmInterruptedError, readWarmStream } from './page-cache-warm'

function controllableStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  const encoder = new TextEncoder()
  return {
    stream,
    send: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
    error: () => controller.error(new Error('connection reset')),
  }
}

const line = (value: object) => `${JSON.stringify(value)}\n`

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

describe('readWarmStream', () => {
  test('reports progress as each line arrives, before the stream has ended', async () => {
    const source = controllableStream()
    const onProgress = vi.fn()
    const result = readWarmStream(source.stream, onProgress)

    source.send(line({ type: 'start', total: 2 }))
    await tick()
    expect(onProgress).toHaveBeenLastCalledWith({ completed: 0, total: 2 })

    source.send(line({ type: 'page', path: '/', status: 200, completed: 1, total: 2 }))
    await tick()
    expect(onProgress).toHaveBeenLastCalledWith({ completed: 1, total: 2 })

    source.send(line({ type: 'page', path: '/about', status: 200, completed: 2, total: 2 }))
    source.send(line({ type: 'done', total: 2, warmed: 2, failed: [] }))
    source.close()

    await expect(result).resolves.toEqual({ total: 2, warmed: 2, failed: [] })
    expect(onProgress).toHaveBeenLastCalledWith({ completed: 2, total: 2 })
  })

  test('reassembles a line split across chunks', async () => {
    const source = controllableStream()
    const result = readWarmStream(source.stream, vi.fn())
    const done = line({ type: 'done', total: 1, warmed: 0, failed: [{ path: '/gone', status: 404 }] })

    source.send(line({ type: 'start', total: 1 }))
    source.send(done.slice(0, 10))
    await tick()
    source.send(done.slice(10))
    source.close()

    await expect(result).resolves.toEqual({ total: 1, warmed: 0, failed: [{ path: '/gone', status: 404 }] })
  })

  test('throws an interruption with the progress so far when the stream ends without a summary', async () => {
    const source = controllableStream()
    const result = readWarmStream(source.stream, vi.fn())

    source.send(line({ type: 'start', total: 36 }))
    source.send(line({ type: 'page', path: '/', status: 200, completed: 12, total: 36 }))
    source.close()

    const error = await result.catch(e => e)
    expect(error).toBeInstanceOf(PageCacheWarmInterruptedError)
    expect(error.progress).toEqual({ completed: 12, total: 36 })
  })

  test('throws an interruption when the connection fails mid-stream', async () => {
    const source = controllableStream()
    const result = readWarmStream(source.stream, vi.fn())

    source.send(line({ type: 'start', total: 36 }))
    await tick()
    source.error()

    const error = await result.catch(e => e)
    expect(error).toBeInstanceOf(PageCacheWarmInterruptedError)
    expect(error.progress).toEqual({ completed: 0, total: 36 })
  })
})

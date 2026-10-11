import { describe, expect, test, vi } from 'vitest'
import { lazyImport } from './lazy-import'

describe('lazyImport', () => {
  test('does not import until load is called', () => {
    const importer = vi.fn(() => Promise.resolve('module'))
    const lazy = lazyImport(importer)
    expect(importer).not.toHaveBeenCalled()
    expect(lazy.loaded).toBeUndefined()
  })

  test('imports once however many times load is called, and exposes the module synchronously afterwards', async () => {
    const importer = vi.fn(() => Promise.resolve('module'))
    const lazy = lazyImport(importer)
    const first = lazy.load()
    const second = lazy.load()
    expect(lazy.loaded).toBeUndefined()
    expect(await first).toBe('module')
    expect(await second).toBe('module')
    expect(importer).toHaveBeenCalledOnce()
    expect(lazy.loaded).toBe('module')
  })

  test('resolves callers in the order they asked', async () => {
    const lazy = lazyImport(() => Promise.resolve('module'))
    const order: number[] = []
    await Promise.all([1, 2, 3].map(caller => lazy.load().then(() => order.push(caller))))
    expect(order).toEqual([1, 2, 3])
  })

  test('a failed import can be retried', async () => {
    const importer = vi.fn()
      .mockImplementationOnce(() => Promise.reject(new Error('chunk failed')))
      .mockImplementationOnce(() => Promise.resolve('module'))
    const lazy = lazyImport(importer)
    await expect(lazy.load()).rejects.toThrow('chunk failed')
    expect(lazy.loaded).toBeUndefined()
    expect(await lazy.load()).toBe('module')
    expect(importer).toHaveBeenCalledTimes(2)
  })
})

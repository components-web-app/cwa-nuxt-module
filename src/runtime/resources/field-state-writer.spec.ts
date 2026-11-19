import { describe, expect, test, vi } from 'vitest'

describe('writeFieldStates (#458)', () => {
  test('writes wait for the lazy module and then run in the order they were made, then run at once', async () => {
    vi.resetModules()
    const { writeFieldStates } = await import('./field-state-writer')
    const order: string[] = []

    writeFieldStates(() => order.push('first'))
    writeFieldStates(() => order.push('second'))
    expect(order).toStrictEqual([])

    await vi.waitFor(() => expect(order).toStrictEqual(['first', 'second']))
    writeFieldStates(() => order.push('third'))
    expect(order).toStrictEqual(['first', 'second', 'third'])
  })

  test('a write made while earlier writes are still waiting for the module runs after them', async () => {
    vi.resetModules()
    const { writeFieldStates } = await import('./field-state-writer')
    const order: string[] = []

    writeFieldStates(() => {
      order.push('first')
      writeFieldStates(() => order.push('made by first'))
    })
    writeFieldStates(() => order.push('second'))

    await vi.waitFor(() => expect(order).toHaveLength(3))
    expect(order).toStrictEqual(['first', 'second', 'made by first'])
  })

  test('the writes are handed the field state functions', async () => {
    vi.resetModules()
    const { writeFieldStates } = await import('./field-state-writer')
    const handed = new Promise(resolve => writeFieldStates(resolve))

    expect(Object.keys(await handed as object)).toEqual(expect.arrayContaining(['edited', 'started', 'succeeded', 'failed', 'held']))
  })
})

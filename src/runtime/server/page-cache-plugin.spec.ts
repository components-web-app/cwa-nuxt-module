// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockSetResponseHeader = vi.fn()
const mockRemoveResponseHeader = vi.fn()

vi.mock('h3', () => ({
  setResponseHeader: (...args: any[]) => mockSetResponseHeader(...args),
  removeResponseHeader: (...args: any[]) => mockRemoveResponseHeader(...args),
}))

vi.mock('nitropack/runtime', () => ({
  defineNitroPlugin: (fn: any) => fn,
}))

const importPlugin = async () => (await import('./page-cache-plugin')).default

async function captureBeforeResponse() {
  const plugin = await importPlugin()
  let hook: ((event: any) => void) | undefined
  plugin({
    hooks: {
      hook: (name: string, fn: (event: any) => void) => {
        if (name === 'beforeResponse') {
          hook = fn
        }
      },
    },
  } as never)
  return hook!
}

const createEvent = (statusCode: number, cwaPageCache?: unknown) => ({
  node: { res: { statusCode } },
  context: cwaPageCache === undefined ? {} : { cwaPageCache },
})

describe('cwa page cache nitro plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('emits both headers on a 200', async () => {
    const beforeResponse = await captureBeforeResponse()
    const event = createEvent(200, {
      surrogateKey: '/_api/_/routes//, /_api/component/titles/abc',
      cacheControl: 'public, max-age=0, s-maxage=300',
    })

    beforeResponse(event)

    expect(mockSetResponseHeader).toHaveBeenCalledWith(event, 'Surrogate-Key', '/_api/_/routes//, /_api/component/titles/abc')
    expect(mockSetResponseHeader).toHaveBeenCalledWith(event, 'Cache-Control', 'public, max-age=0, s-maxage=300')
  })

  test('sends no-store and no Surrogate-Key when the render resolved to a redirect', async () => {
    const beforeResponse = await captureBeforeResponse()
    const event = createEvent(308, {
      surrogateKey: '/_api/_/routes//',
      cacheControl: 'public, max-age=0, s-maxage=300',
    })

    beforeResponse(event)

    expect(mockRemoveResponseHeader).toHaveBeenCalledWith(event, 'Surrogate-Key')
    expect(mockSetResponseHeader).toHaveBeenCalledWith(event, 'Cache-Control', 'no-store')
    expect(mockSetResponseHeader).toHaveBeenCalledTimes(1)
  })

  test('forces private, no-store when the render was personalised', async () => {
    const beforeResponse = await captureBeforeResponse()
    const event = createEvent(200, { unstorable: true })

    beforeResponse(event)

    expect(mockSetResponseHeader).toHaveBeenCalledWith(event, 'Cache-Control', 'private, no-store')
    expect(mockSetResponseHeader).toHaveBeenCalledTimes(1)
  })

  test('leaves a 200 alone when CWA rendered no resources', async () => {
    const beforeResponse = await captureBeforeResponse()

    beforeResponse(createEvent(200, {}))

    expect(mockSetResponseHeader).not.toHaveBeenCalled()
    expect(mockRemoveResponseHeader).not.toHaveBeenCalled()
  })

  test('ignores requests that ran no CWA render', async () => {
    const beforeResponse = await captureBeforeResponse()

    beforeResponse(createEvent(404))
    beforeResponse(createEvent(200))

    expect(mockSetResponseHeader).not.toHaveBeenCalled()
    expect(mockRemoveResponseHeader).not.toHaveBeenCalled()
  })
})

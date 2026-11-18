import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { KIT_SAVE_DELAY, createFakeSaveServer } from './fake-save-server'
import { practiceFetch } from './practice-transport'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function setup() {
  const real = Object.assign(vi.fn(), { raw: vi.fn(), native: vi.fn(), create: vi.fn() })
  const server = createFakeSaveServer()
  const fetch = practiceFetch(real, {
    server,
    current: iri => ({ '@id': iri, '@type': 'Title', 'title': 'Old', '_metadata': { persisted: true } }),
    usage: () => ({ total: 2, positionCount: 2, pageDataCount: 0 }),
  })
  return { real, server, fetch }
}

describe('the In practice transport answers the real admin chrome from the fake adapter', () => {
  test('a PATCH goes through the fake adapter and answers with the stored resource merged with the patch', async () => {
    const { fetch, server, real } = setup()
    const answer = fetch('/component/titles/1?published=false', { method: 'PATCH', body: { title: 'New' } })
    await vi.advanceTimersByTimeAsync(KIT_SAVE_DELAY)
    await expect(answer).resolves.toMatchObject({ '@id': '/component/titles/1', 'title': 'New' })
    expect(server.state.requests).toBe(1)
    expect(real).not.toHaveBeenCalled()
  })

  test('a failure chosen on the adapter reaches the chrome as the API error shape', async () => {
    const { fetch, server } = setup()
    server.failNext('422')
    const answer = fetch('/component/titles/1', { method: 'PATCH', body: JSON.stringify({ title: 'Taken' }) })
    const failed = expect(answer).rejects.toMatchObject({ statusCode: 422, data: { violations: [{ propertyPath: 'title' }] } })
    await vi.advanceTimersByTimeAsync(KIT_SAVE_DELAY)
    await failed
  })

  test('usage answers locally, presence posts are swallowed, and no GET reaches the real API', async () => {
    const { fetch, real } = setup()
    await expect(fetch.raw('/component/titles/1/usage')).resolves.toMatchObject({ _data: { total: 2 } })
    await expect(fetch('/_/realtime', { method: 'POST', body: {} })).resolves.toEqual({})
    await expect(fetch('/me')).rejects.toEqual({ message: 'The kit has no API.' })
    expect(real).not.toHaveBeenCalled()
    expect(real.raw).not.toHaveBeenCalled()
  })

  test('a POST creates a persisted resource under the endpoint', async () => {
    const { fetch } = setup()
    const answer = fetch('/component/titles', { method: 'POST', body: { title: 'Added' } })
    await vi.advanceTimersByTimeAsync(KIT_SAVE_DELAY)
    await expect(answer).resolves.toMatchObject({ '@id': '/component/titles/kit-1', 'title': 'Added', '_metadata': { persisted: true } })
  })
})

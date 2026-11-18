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
    peer: { clientId: 'kit-mia', userId: '/_/users/mia' },
    now: () => new Date('2026-11-18T10:00:00.000Z'),
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

  test('usage answers locally, presence posts are swallowed, and no request reaches the real API', async () => {
    const { fetch, real } = setup()
    await expect(fetch.raw('/component/titles/1/usage')).resolves.toMatchObject({ _data: { total: 2 } })
    await expect(fetch('/_/realtime', { method: 'POST', body: {} })).resolves.toEqual({})
    expect(real).not.toHaveBeenCalled()
    expect(real.raw).not.toHaveBeenCalled()
  })

  test('a GET answers with the stored resource, so the page settings dialog can load it, and anything else is a 404', async () => {
    const { fetch } = setup()
    await expect(fetch.raw('/component/titles/1')).resolves.toMatchObject({ _data: { '@id': '/component/titles/1', 'title': 'Old' } })
    const unknown = { '@id': '/x', '@type': 'X' }
    const lookup = practiceFetch(Object.assign(vi.fn(), { raw: vi.fn() }), {
      server: createFakeSaveServer(),
      current: iri => iri === '/x' ? unknown as never : undefined,
      usage: () => ({ total: 1, positionCount: 1, pageDataCount: 0 }),
      peer: { clientId: 'kit-mia', userId: '/_/users/mia' },
    })
    await expect(lookup('/_/collaboration_states/1')).rejects.toMatchObject({ statusCode: 404, response: { status: 404 } })
  })

  test('a GET answers with a copy, so a reload of a stored resource reaches the watchers that wait for it', async () => {
    const stored = { '@id': '/_/pages/1', '@type': 'Page', 'reference': 'Home' }
    const fetch = practiceFetch(Object.assign(vi.fn(), { raw: vi.fn() }), {
      server: createFakeSaveServer(),
      current: iri => iri === stored['@id'] ? stored as never : undefined,
      usage: () => ({ total: 1, positionCount: 1, pageDataCount: 0 }),
      peer: { clientId: 'kit-mia', userId: '/_/users/mia' },
    })
    const answer = await fetch('/_/pages/1')
    expect(answer).toEqual(stored)
    expect(answer).not.toBe(stored)
  })

  test('a collection GET lists what the page holds, so the page settings lists load instead of failing', async () => {
    const fetch = practiceFetch(Object.assign(vi.fn(), { raw: vi.fn() }), {
      server: createFakeSaveServer(),
      current: () => undefined,
      members: collection => collection === '/_/pages' ? [{ '@id': '/_/pages/1', '@type': 'Page' } as never] : [],
      usage: () => ({ total: 1, positionCount: 1, pageDataCount: 0 }),
      peer: { clientId: 'kit-mia', userId: '/_/users/mia' },
    })
    await expect(fetch('/_/pages?perPage=100')).resolves.toEqual({ member: [{ '@id': '/_/pages/1', '@type': 'Page' }], totalItems: 1 })
    await expect(fetch('/_/layouts?perPage=100')).resolves.toEqual({ member: [], totalItems: 0 })
  })

  test('a 412 answers with Mia\'s whole resource, written by her client, so the real conflict handling raises it on the field', async () => {
    const { fetch, server } = setup()
    server.theirs.title = 'Mia\'s title'
    server.failNext('412')
    const answer = fetch('/component/titles/1', { method: 'PATCH', body: { title: 'Mine' } })
    const failed = expect(answer).rejects.toMatchObject({
      statusCode: 412,
      data: { '@id': '/component/titles/1', '@type': 'Title', 'title': 'Mia\'s title', '_metadata': { persisted: true, lastWrite: { clientId: 'kit-mia', userId: '/_/users/mia', at: '2026-11-18T10:00:00.000Z' } } },
    })
    await vi.advanceTimersByTimeAsync(KIT_SAVE_DELAY)
    await failed
  })

  test('a POST creates a persisted resource under the endpoint', async () => {
    const { fetch } = setup()
    const answer = fetch('/component/titles', { method: 'POST', body: { title: 'Added' } })
    await vi.advanceTimersByTimeAsync(KIT_SAVE_DELAY)
    await expect(answer).resolves.toMatchObject({ '@id': '/component/titles/kit-1', 'title': 'Added', '_metadata': { persisted: true } })
  })
})

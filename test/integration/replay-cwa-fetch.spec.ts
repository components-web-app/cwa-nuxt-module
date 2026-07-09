// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest'
import { ReplayCwaFetch, flush } from './replay-cwa-fetch'
import type { Cassette } from './replay-cwa-fetch'

const cassette: Cassette = {
  name: 'test',
  entries: [
    { method: 'GET', path: '/_api/_/routes//page', status: 200, body: { '@id': '/_api/_/routes//page', 'page': '/_api/_/pages/p' }, headers: { link: '<x>; rel="mercure"' } },
    { method: 'GET', path: '/_api/_/pages/p', status: 200, body: { '@id': '/_api/_/pages/p' }, headers: {} },
    { method: 'GET', path: '/_api/component/missing', status: 404, body: { 'hydra:description': 'Not Found' }, headers: {} },
  ],
}

describe('#246 ReplayCwaFetch', () => {
  test('serves a recorded 2xx response with body + headers via fetch.raw', async () => {
    const replay = new ReplayCwaFetch(cassette)
    const res = await replay.fetch.raw('/_api/_/routes//page') as any
    expect(res._data.page).toBe('/_api/_/pages/p')
    expect(res.headers.get('link')).toBe('<x>; rel="mercure"')
    expect(res.status).toBe(200)
  })

  test('ignores query strings when matching a path', async () => {
    const replay = new ReplayCwaFetch(cassette)
    const res = await replay.fetch.raw('/_api/_/pages/p?preload=%2Fcomponent') as any
    expect(res._data['@id']).toBe('/_api/_/pages/p')
  })

  test('throws an ofetch-shaped error for a non-2xx entry', async () => {
    const replay = new ReplayCwaFetch(cassette)
    await expect(replay.fetch.raw('/_api/component/missing')).rejects.toMatchObject({ statusCode: 404 })
  })

  test('throws 404 for an unknown path', async () => {
    const replay = new ReplayCwaFetch(cassette)
    await expect(replay.fetch.raw('/_api/_/routes//nope')).rejects.toMatchObject({ statusCode: 404 })
  })

  test('logs every requested path', async () => {
    const replay = new ReplayCwaFetch(cassette)
    await replay.fetch.raw('/_api/_/routes//page')
    await replay.fetch.raw('/_api/_/pages/p')
    expect(replay.requestLog).toEqual(['/_api/_/routes//page', '/_api/_/pages/p'])
  })

  describe('manual timing control', () => {
    test('holds requests until released, enabling deterministic interleaving', async () => {
      const replay = new ReplayCwaFetch(cassette, { manual: true })

      let aDone = false
      let bDone = false
      const a = replay.fetch.raw('/_api/_/routes//page').then(() => {
        aDone = true
      })
      const b = replay.fetch.raw('/_api/_/pages/p').then(() => {
        bDone = true
      })

      await flush()
      // nothing resolves until released
      expect(aDone).toBe(false)
      expect(bDone).toBe(false)
      expect(replay.pending()).toEqual(['/_api/_/routes//page', '/_api/_/pages/p'])

      // release only the second — the first stays pending
      expect(replay.release('/_api/_/pages/p')).toBe(1)
      await b
      expect(bDone).toBe(true)
      expect(aDone).toBe(false)
      expect(replay.pending()).toEqual(['/_api/_/routes//page'])

      expect(replay.releaseAll()).toBe(1)
      await a
      expect(aDone).toBe(true)
    })
  })
})

import { afterEach, describe, expect, test, vi } from 'vitest'
import { createCollaborationState, htmlHash } from './y-state'
import type { CollaborationStateFetch } from './y-state'

const COMPONENT = '/component/html_contents/1'
const PAGE_DATA = '/page_data/blog_articles/1'
const STATE_IRI = '/_/collaboration_states/abc'

function item(version: number, overrides: Record<string, unknown> = {}) {
  return { '@id': STATE_IRI, 'component': COMPONENT, 'field': 'html', 'state': 'AAA=', 'htmlHash': htmlHash('<p>Stored</p>'), '_metadata': { version }, ...overrides }
}

function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status }, data })
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function client(fetch: ReturnType<typeof vi.fn>, iri = COMPONENT) {
  return createCollaborationState(fetch as CollaborationStateFetch, { iri: () => iri, field: 'html', encode: () => new Uint8Array([1, 2, 3]) })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('htmlHash: telling whether a stored state was made from the HTML loaded (#435)', () => {
  test('is the same for the same HTML, different for different HTML, and treats no HTML as empty', () => {
    expect(htmlHash('<p>Hello</p>')).toBe(htmlHash('<p>Hello</p>'))
    expect(htmlHash('<p>Hello</p>')).not.toBe(htmlHash('<p>Hullo</p>'))
    expect(htmlHash(null)).toBe(htmlHash(''))
    expect(htmlHash(undefined)).toBe(htmlHash(''))
  })
})

describe('loading the stored Yjs state of a field (api-components-bundle#563)', () => {
  test('asks for the component\'s field and returns its one state', async () => {
    const fetch = vi.fn().mockResolvedValue({ member: [item(3)] })

    await expect(client(fetch).load()).resolves.toEqual({ state: 'AAA=', htmlHash: htmlHash('<p>Stored</p>') })
    expect(fetch).toHaveBeenCalledWith('/_/collaboration_states', { query: { component: COMPONENT, field: 'html' } })
  })

  test('asks by page data for a page data field', async () => {
    const fetch = vi.fn().mockResolvedValue({ member: [] })

    await client(fetch, PAGE_DATA).load()

    expect(fetch).toHaveBeenCalledWith('/_/collaboration_states', { query: { pageData: PAGE_DATA, field: 'html' } })
  })

  test('an empty list is no state', async () => {
    const fetch = vi.fn().mockResolvedValue({ member: [] })

    await expect(client(fetch).load()).resolves.toBeUndefined()
  })

  test('a failed request is no state, with a warning naming the bundle version it needs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetch = vi.fn().mockRejectedValue(httpError(404))

    await expect(client(fetch).load()).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('2.0.0-alpha.37'))
  })
})

describe('saving the Yjs state of a field (api-components-bundle#563)', () => {
  test('creates the state when none was loaded, with the hash of the HTML it goes with', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ member: [] }).mockResolvedValueOnce(item(1))
    const state = client(fetch)
    await state.load()

    await state.save('<p>Saved</p>')

    expect(fetch).toHaveBeenLastCalledWith('/_/collaboration_states', {
      method: 'POST',
      headers: { 'content-type': 'application/ld+json' },
      body: { component: COMPONENT, field: 'html', state: 'AQID', htmlHash: htmlHash('<p>Saved</p>') },
    })
  })

  test('replaces a loaded state only if it is still the version loaded, then sends the version it got back', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ member: [item(3)] }).mockResolvedValueOnce(item(4)).mockResolvedValueOnce(item(5))
    const state = client(fetch)
    await state.load()

    await state.save('<p>One</p>')
    await state.save('<p>Two</p>')

    expect(fetch).toHaveBeenNthCalledWith(2, STATE_IRI, {
      method: 'PATCH',
      headers: { 'content-type': 'application/merge-patch+json', 'if-match': '"3"' },
      body: { state: 'AQID', htmlHash: htmlHash('<p>One</p>') },
    })
    expect(fetch.mock.calls[2]![1].headers['if-match']).toBe('"4"')
  })

  test('a stale version is replaced once with the version the 412 carries', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ member: [item(3)] })
      .mockRejectedValueOnce(httpError(412, item(7)))
      .mockResolvedValueOnce(item(8))
    const state = client(fetch)
    await state.load()

    await state.save('<p>Mine</p>')

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[2]![1].headers['if-match']).toBe('"7"')
    expect(fetch.mock.calls[2]![1].body.htmlHash).toBe(htmlHash('<p>Mine</p>'))
  })

  test('a second 412 in a row is left for the next save', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ member: [item(3)] })
      .mockRejectedValueOnce(httpError(412, item(7)))
      .mockRejectedValueOnce(httpError(412, item(9)))
      .mockResolvedValueOnce(item(10))
    const state = client(fetch)
    await state.load()

    await state.save('<p>Mine</p>')
    expect(fetch).toHaveBeenCalledTimes(3)

    await state.save('<p>Mine again</p>')
    expect(fetch.mock.calls[3]![1].headers['if-match']).toBe('"9"')
  })

  test('a state another window created first is fetched and replaced', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ member: [] })
      .mockRejectedValueOnce(httpError(422))
      .mockResolvedValueOnce({ member: [item(2)] })
      .mockResolvedValueOnce(item(3))
    const state = client(fetch)
    await state.load()

    await state.save('<p>Mine</p>')

    expect(fetch.mock.calls[3]![0]).toBe(STATE_IRI)
    expect(fetch.mock.calls[3]![1].headers['if-match']).toBe('"2"')
  })

  test('one write at a time: saves made while one is in flight become one write, of the newest HTML', async () => {
    const first = deferred<unknown>()
    const fetch = vi.fn()
      .mockResolvedValueOnce({ member: [item(3)] })
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(item(5))
    const state = client(fetch)
    await state.load()

    const saving = state.save('<p>One</p>')
    const queued = [state.save('<p>Two</p>'), state.save('<p>Three</p>')]
    first.resolve(item(4))
    await Promise.all([saving, ...queued])

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[2]![1]).toMatchObject({ headers: { 'if-match': '"4"' }, body: { htmlHash: htmlHash('<p>Three</p>') } })
  })

  test('saving without loading first looks the state up before writing', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ member: [item(6)] }).mockResolvedValueOnce(item(7))

    await client(fetch).save('<p>Mine</p>')

    expect(fetch.mock.calls[0]![1]).toEqual({ query: { component: COMPONENT, field: 'html' } })
    expect(fetch.mock.calls[1]![1].headers['if-match']).toBe('"6"')
  })
})

describe('creating the state from the seed, and writing only what changed (#435)', () => {
  test('creates the state from the update it is given, with the hash of the HTML it was seeded from', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(item(1))

    await expect(client(fetch).create(new Uint8Array([9, 9]), '<p>Seeded</p>')).resolves.toBe('created')

    expect(fetch).toHaveBeenCalledWith('/_/collaboration_states', {
      method: 'POST',
      headers: { 'content-type': 'application/ld+json' },
      body: { component: COMPONENT, field: 'html', state: 'CQk=', htmlHash: htmlHash('<p>Seeded</p>') },
    })
  })

  test('a state another window created first is reported as existing, and a failed create as failed', async () => {
    await expect(client(vi.fn().mockRejectedValueOnce(httpError(422))).create(new Uint8Array([9]), '<p>Seeded</p>')).resolves.toBe('exists')
    await expect(client(vi.fn().mockRejectedValueOnce(httpError(500))).create(new Uint8Array([9]), '<p>Seeded</p>')).resolves.toBe('failed')
  })

  test('saving the state and HTML just loaded, created or written writes nothing', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ member: [item(3, { state: 'AQID', htmlHash: htmlHash('<p>Stored</p>') })] })
      .mockResolvedValueOnce(item(4, { state: 'AQID', htmlHash: htmlHash('<p>New</p>') }))
    const state = client(fetch)
    await state.load()

    await expect(state.save('<p>Stored</p>')).resolves.toBe(true)
    await state.save('<p>New</p>')
    await state.save('<p>New</p>')

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1]![1].body.htmlHash).toBe(htmlHash('<p>New</p>'))
  })

  test('a save that could not be written resolves false', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ member: [item(3)] }).mockRejectedValueOnce(httpError(500))
    const state = client(fetch)
    await state.load()

    await expect(state.save('<p>Mine</p>')).resolves.toBe(false)
  })
})

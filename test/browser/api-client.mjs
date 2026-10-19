import { cleanupHeader, seedHeader } from './rehearsal.mjs'

export const apiPrefix = '/_api'

export function createApiClient(origin, { username = 'admin', password = 'admin' } = {}) {
  let cookie = ''
  let authCookie
  const created = []

  async function request(method, path, body, extraHeaders = {}) {
    const url = `${origin}${path.startsWith(apiPrefix) ? path : `${apiPrefix}${path}`}`
    const response = await fetch(url, {
      method,
      headers: {
        accept: 'application/ld+json',
        ...(body === undefined ? {} : { 'content-type': method === 'PATCH' ? 'application/merge-patch+json' : 'application/ld+json' }),
        ...(cookie ? { cookie } : {}),
        [seedHeader]: '1',
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    const text = await response.text()
    let data
    try {
      data = text ? JSON.parse(text) : undefined
    }
    catch {
      data = text
    }
    return { status: response.status, data, response }
  }

  async function expectOk(method, path, body) {
    const result = await request(method, path, body)
    if (result.status >= 400) {
      throw new Error(`Seeding ${method} ${path} failed with ${result.status}: ${JSON.stringify(result.data)?.slice(0, 500)}`)
    }
    return result.data
  }

  return {
    get authCookie() {
      return authCookie
    },
    async login() {
      const { status, response } = await request('POST', '/login', { username, password })
      if (status >= 400) {
        throw new Error(`Signing in as ${username} failed with ${status}`)
      }
      const cookies = response.headers.getSetCookie().map(value => value.split(';')[0])
      cookie = cookies.join('; ')
      const jwt = cookies.find(value => value.startsWith('api_component='))
      authCookie = jwt ? { name: 'api_component', value: jwt.slice('api_component='.length) } : undefined
    },
    async create(path, body) {
      const resource = await expectOk('POST', path, body)
      created.push(resource['@id'])
      return resource
    },
    async patch(iri, body) {
      return expectOk('PATCH', iri, body)
    },
    async remove(iri) {
      return request('DELETE', iri)
    },
    async status(iri) {
      return (await request('GET', iri)).status
    },
    async cleanup() {
      for (const iri of [...created].reverse()) {
        await request('DELETE', iri, undefined, { [cleanupHeader]: '1' }).catch(() => undefined)
      }
      created.length = 0
    },
  }
}

import http from 'node:http'
import https from 'node:https'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const rehearsalsDir = resolve(dirname(fileURLToPath(import.meta.url)), 'rehearsals')
export const mercurePath = '/.well-known/mercure'
export const seedHeader = 'x-rehearsal-seed'
export const cleanupHeader = 'x-rehearsal-cleanup'

const keptResponseHeaders = ['content-type', 'link', 'cache-control', 'expires', 'vary', 'location', 'set-cookie', 'retry-after', 'date']
const forwardedRequestHeaders = ['accept', 'content-type', 'cookie', 'path', 'preload', 'authorization', 'user-agent', 'x-cwa-client-id', 'if-match']
const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const realtimePath = /\/_\/realtime$/

function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])]))
  }
  return value
}

function parseBody(raw) {
  if (!raw) {
    return undefined
  }
  try {
    return JSON.parse(raw)
  }
  catch {
    return raw
  }
}

function matchedBody(url, body) {
  if (body && typeof body === 'object' && 'state' in body && url.split('?')[0].includes('/_/collaboration_states')) {
    return Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'state'))
  }
  return body
}

function requestKey({ method, url, path, body }) {
  return JSON.stringify([method, url, path ?? null, body === undefined ? null : sortKeys(matchedBody(url, body))])
}

export function rehearsalFileName(title) {
  const [number] = title.split('.')
  const slug = title.slice(number.length + 1).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '')
  return `${number.padStart(2, '0')}-${slug}.json.gz`
}

function redactCookie(cookie) {
  return cookie.replace(/^([^=]+)=[^;]*/, '$1=rehearsal')
}

function serveCookies(cookies) {
  return [].concat(cookies)
    .filter(cookie => !/^__(Secure|Host)-/.test(cookie))
    .map(cookie => cookie.split(';').filter(part => !/^\s*(secure|domain=.*|partitioned)\s*$/i.test(part)).join(';'))
}

export class UnrecordedRequestError extends Error {}

/**
 * @param {{ port: number, mode: 'record' | 'replay', dir?: string, target?: string, ca?: string, bundle?: string }} options
 */
export async function startRehearsal({ port, mode, dir = rehearsalsDir, target, ca, bundle }) {
  const origin = `http://127.0.0.1:${port}`
  const targetUrl = target ? new URL(target) : undefined
  const agent = targetUrl?.protocol === 'https:' ? new https.Agent({ keepAlive: true, ca: ca ? readFileSync(ca) : undefined }) : new http.Agent({ keepAlive: true })
  const streams = new Set()
  let scenario

  function corsHeaders(req) {
    return {
      'access-control-allow-origin': req.headers.origin || '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type, accept, path, preload, authorization, x-cwa-client-id, if-match',
      'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'access-control-expose-headers': 'link, retry-after, date, etag',
    }
  }

  function servedHeaders(req, headers, apiOrigin) {
    const out = { ...corsHeaders(req) }
    for (const [name, value] of Object.entries(headers)) {
      if (name === 'link') {
        out.link = String(value).replaceAll(apiOrigin, origin).replace(/<[^>]*>(;\s*rel="mercure")/, `<${origin}${mercurePath}>$1`)
      }
      else if (name === 'set-cookie') {
        out['set-cookie'] = serveCookies(value)
      }
      else {
        out[name] = typeof value === 'string' ? value.replaceAll(apiOrigin, origin) : value
      }
    }
    return out
  }

  function forward(req, raw) {
    return new Promise((resolve, reject) => {
      const headers = { 'accept-encoding': 'identity', 'host': targetUrl.host, 'origin': targetUrl.origin }
      for (const name of forwardedRequestHeaders) {
        if (req.headers[name] !== undefined) {
          headers[name] = req.headers[name]
        }
      }
      if (raw) {
        headers['content-length'] = Buffer.byteLength(raw)
      }
      const outgoing = (targetUrl.protocol === 'https:' ? https : http).request(new URL(req.url, targetUrl), { method: req.method, headers, agent }, (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          text += chunk
        })
        res.on('end', () => {
          const kept = {}
          for (const name of keptResponseHeaders) {
            if (res.headers[name] !== undefined) {
              kept[name] = res.headers[name]
            }
          }
          resolve({ status: res.statusCode, headers: kept, body: parseBody(text) })
        })
        res.on('error', reject)
      })
      outgoing.setTimeout(30000, () => outgoing.destroy(new Error('the API did not answer within 30s')))
      outgoing.on('error', reject)
      outgoing.end(raw || undefined)
    })
  }

  function replay(request) {
    const exact = requestKey(request)
    const key = scenario.byKey.has(exact) ? exact : requestKey({ ...request, path: undefined })
    const candidates = scenario.byKey.get(key)
    if (!candidates) {
      return
    }
    const settled = candidates.filter(entry => entry.epoch <= scenario.epoch)
    const epoch = settled.length ? settled.at(-1).epoch : candidates[0].epoch
    const group = candidates.filter(entry => entry.epoch === epoch)
    const usedKey = `${epoch}|${key}`
    const used = scenario.used.get(usedKey) ?? 0
    scenario.used.set(usedKey, used + 1)
    const entry = group[Math.min(used, group.length - 1)]
    return entry.response
  }

  function send(res, req, status, headers, body, apiOrigin = 'http://rehearsal.invalid') {
    const payload = (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)).replaceAll(apiOrigin, origin)
    res.writeHead(status, servedHeaders(req, headers, apiOrigin))
    res.end(payload)
  }

  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(req))
      res.end()
      return
    }
    if (new URL(req.url, origin).pathname === mercurePath) {
      if (scenario) {
        scenario.mercureSubscriptions++
      }
      res.writeHead(200, { ...corsHeaders(req), 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
      res.write(':\n\n')
      streams.add(res)
      res.on('close', () => streams.delete(res))
      return
    }
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', async () => {
      if (!scenario && !req.headers[cleanupHeader]) {
        send(res, req, 503, { 'content-type': 'application/json' }, { error: 'No rehearsal scenario is running' })
        return
      }
      if (req.headers[cleanupHeader]) {
        if (mode !== 'record') {
          send(res, req, 204, {})
          return
        }
        const response = await forward(req, raw).catch(error => ({ status: 502, headers: {}, body: { error: error.message } }))
        send(res, req, response.status, response.headers, response.body, targetUrl.origin)
        return
      }
      const current = scenario
      if (req.method === 'POST' && realtimePath.test(new URL(req.url, origin).pathname)) {
        current.realtime.push(parseBody(raw))
        send(res, req, 202, {})
        return
      }
      const request = { method: req.method, url: req.url, path: req.headers.path, body: parseBody(raw) }
      const isWrite = writeMethods.has(req.method)
      if (isWrite && !req.headers[seedHeader]) {
        current.writes.push({ method: req.method, path: req.url, body: request.body })
      }
      if (mode === 'record') {
        const epoch = current.epoch
        try {
          const handling = (async () => {
            const response = await forward(req, raw)
            current.entries.push({ epoch, request: { ...request, path: request.path ?? undefined }, response })
            if (isWrite) {
              current.epoch++
            }
            return response
          })()
          current.pending.add(handling)
          const response = await handling.finally(() => current.pending.delete(handling))
          send(res, req, response.status, response.headers, response.body, current.apiOrigin)
        }
        catch (error) {
          send(res, req, 502, { 'content-type': 'application/json' }, { error: `Rehearsal proxy could not reach ${target}: ${error.message}` })
        }
        return
      }
      const response = replay(request)
      if (!response) {
        current.unrecorded.push(`${request.method} ${request.url}${request.path ? ` (path: ${request.path})` : ''}${raw ? ` ${raw}` : ''}`)
        send(res, req, 599, { 'content-type': 'application/json' }, { error: 'This request is not in the rehearsal' })
        return
      }
      if (isWrite) {
        current.epoch++
      }
      send(res, req, response.status, response.headers, response.body, current.apiOrigin)
    })
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })

  function closeStreams() {
    for (const stream of streams) {
      stream.end()
    }
    streams.clear()
  }

  return {
    origin,
    mode,
    begin(title) {
      const file = join(dir, rehearsalFileName(title))
      scenario = { title, file, entries: [], writes: [], realtime: [], unrecorded: [], epoch: 0, mercureSubscriptions: 0, used: new Map(), byKey: new Map(), pending: new Set() }
      if (mode === 'record') {
        scenario.token = randomBytes(4).toString('hex')
        scenario.apiOrigin = targetUrl.origin
        return scenario
      }
      if (!existsSync(file)) {
        throw new UnrecordedRequestError(`No rehearsal for "${title}" at ${file}. Rehearse it against a real API first.`)
      }
      const recording = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'))
      scenario.token = recording.token
      scenario.apiOrigin = new URL(recording.api).origin
      for (const entry of recording.entries) {
        for (const key of new Set([requestKey(entry.request), requestKey({ ...entry.request, path: undefined })])) {
          scenario.byKey.set(key, [...(scenario.byKey.get(key) ?? []), entry])
        }
      }
      return scenario
    },
    publish(data, { id } = {}) {
      const message = `${id === undefined ? '' : `id: ${id}\n`}data: ${JSON.stringify(data)}\n\n`
      for (const stream of streams) {
        stream.write(message)
      }
    },
    async end({ save }) {
      closeStreams()
      const finished = scenario
      if (!finished) {
        return
      }
      await Promise.race([Promise.allSettled([...finished.pending]), new Promise(resolve => setTimeout(resolve, 10000))])
      scenario = undefined
      if (mode === 'record' && save) {
        mkdirSync(dir, { recursive: true })
        const entries = finished.entries.map(({ epoch, request, response }) => ({
          epoch,
          request,
          response: {
            ...response,
            headers: { ...response.headers, ...(response.headers['set-cookie'] ? { 'set-cookie': [].concat(response.headers['set-cookie']).map(redactCookie) } : {}) },
          },
        }))
        const recording = { scenario: finished.title, token: finished.token, api: target, bundle, recordedAt: new Date().toISOString(), entries }
        writeFileSync(finished.file, gzipSync(`${JSON.stringify(recording, null, 1)}\n`, { level: 9 }))
      }
      return finished
    },
    async stop() {
      closeStreams()
      agent.destroy()
      server.closeAllConnections?.()
      await new Promise(resolve => server.close(resolve))
    },
  }
}

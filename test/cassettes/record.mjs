#!/usr/bin/env node
/**
 * #246 — Record real CWA API responses into a replay cassette for deterministic integration tests.
 *
 * Usage (dev API must be running; self-signed cert is accepted):
 *   node test/cassettes/record.mjs <cassette-name> <routePath> [routePath...]
 *
 * e.g. node test/cassettes/record.mjs topic-1-nested /topic-1 /topic-1/chapter-one /topic-1/chapter-two /
 *
 * For each route path it records the route resource, its manifest, and every resource IRI in the
 * manifest tree (deduped). Keyed by the exact request path the fetcher issues (with the /_api prefix).
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const ORIGIN = 'https://localhost'
const PREFIX = '/_api'
const HERE = dirname(fileURLToPath(import.meta.url))

const cassetteName = process.argv[2]
const routePaths = process.argv.slice(3)
if (!cassetteName || !routePaths.length) {
  console.error('Usage: node test/cassettes/record.mjs <cassette-name> <routePath> [routePath...]')
  process.exit(1)
}

const entries = new Map() // cleanPath -> entry

async function record(path) {
  const clean = path.split('?')[0]
  if (entries.has(clean)) {
    return entries.get(clean)
  }
  let status = 0
  let body = null
  let link = null
  try {
    const res = await fetch(`${ORIGIN}${clean}`, { headers: { accept: 'application/ld+json,application/json' } })
    status = res.status
    link = res.headers.get('link')
    try {
      body = await res.json()
    }
    catch {
      body = null
    }
  }
  catch (e) {
    console.error(`  ! request failed for ${clean}: ${e.message}`)
  }
  const entry = { method: 'GET', path: clean, status, body, headers: link ? { link } : {} }
  entries.set(clean, entry)
  return entry
}

function flattenTree(nodes) {
  const iris = []
  const walk = (n) => {
    if (n?.iri) {
      iris.push(n.iri)
    }
    ;(n?.children || []).forEach(walk)
  }
  ;(nodes || []).forEach(walk)
  return iris
}

for (const rp of routePaths) {
  console.log(`recording route ${rp} ...`)
  await record(`${PREFIX}/_/routes/${rp}`)
  const manifest = await record(`${PREFIX}/_/resource_manifest/${rp}`)
  const iris = flattenTree(manifest.body?.resource_iris)
  for (const iri of iris) {
    await record(iri)
  }
}

mkdirSync(HERE, { recursive: true })
const outPath = `${HERE}/${cassetteName}.json`
writeFileSync(outPath, JSON.stringify({ name: cassetteName, recordedAt: '', entries: [...entries.values()] }, null, 2))
console.log(`\nRecorded ${entries.size} entries -> test/cassettes/${cassetteName}.json`)

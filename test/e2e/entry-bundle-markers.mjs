import { gzipSync } from 'node:zlib'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outputDir = resolve(here, '../../playground/.output')
const manifestPath = resolve(outputDir, 'server/chunks/virtual/precomputed.mjs')
const chunkDir = resolve(outputDir, 'public/_nuxt')

const forbidden = [
  { marker: 'Invalid DateTime', source: 'luxon' },
  { marker: 'InvalidXml', source: 'fast-xml-parser' },
  { marker: 'headlessui', source: '@headlessui/vue' },
  { marker: 'data-reka-date-field-segment', source: 'reka-ui' },
  { marker: 'preventOverflow', source: '@popperjs/core' },
  { marker: 'OES_texture_half_float', source: 'ui/BackgroundParticles.vue' },
]

async function readEntryChunks() {
  if (!existsSync(manifestPath)) {
    throw new Error(`No playground build at ${outputDir}. Run "pnpm run dev:build" first.`)
  }
  const manifest = (await import(manifestPath)).default
  const entryKey = Object.keys(manifest.dependencies).find(key => key.endsWith('nuxt/dist/app/entry.js'))
  if (!entryKey) {
    throw new Error('Could not find the Nuxt app entry in the client manifest')
  }
  const chunks = []
  for (const asset of Object.values(manifest.dependencies[entryKey].preload)) {
    if (asset.resourceType !== 'script') {
      continue
    }
    const file = resolve(chunkDir, asset.file)
    if (!existsSync(file)) {
      throw new Error(`Manifest references a missing chunk: ${asset.file}`)
    }
    chunks.push({ name: asset.name || asset.file, file, contents: readFileSync(file, 'utf8'), size: statSync(file).size })
  }
  return chunks
}

function main() {
  return readEntryChunks().then((chunks) => {
    const raw = chunks.reduce((total, chunk) => total + chunk.size, 0)
    const gzip = chunks.reduce((total, chunk) => total + gzipSync(chunk.contents, { level: 9 }).length, 0)
    console.log(`Entry modulepreload graph: ${chunks.length} chunks, ${raw} B raw, ${gzip} B gzip`)

    const found = []
    for (const { marker, source } of forbidden) {
      const hits = chunks.filter(chunk => chunk.contents.includes(marker)).map(chunk => chunk.name)
      console.log(`  ${hits.length ? 'FOUND  ' : 'absent '} ${source} (${marker})${hits.length ? ` in ${hits.join(', ')}` : ''}`)
      if (hits.length) {
        found.push({ source, marker, hits })
      }
    }

    if (found.length) {
      console.error('\nFAIL: admin-only or error-only code is in the entry chunk graph every visitor downloads (#331).')
      for (const { source, hits } of found) {
        console.error(`  ${source} -> ${hits.join(', ')}`)
      }
      process.exit(1)
    }

    console.log('\nPASS: no admin-only or error-only marker in the entry modulepreload graph.')
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

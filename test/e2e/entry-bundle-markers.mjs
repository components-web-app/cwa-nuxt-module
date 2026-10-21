import { gzipSync } from 'node:zlib'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outputDir = resolve(here, '../../playground/.output')
const manifestPath = resolve(outputDir, 'server/chunks/virtual/precomputed.mjs')
const chunkDir = resolve(outputDir, 'public/_nuxt')

const gzipBudget = 163070

const forbidden = [
  { marker: 'Invalid DateTime', source: 'luxon' },
  { marker: 'InvalidXml', source: 'fast-xml-parser' },
  { marker: 'headlessui', source: '@headlessui/vue' },
  { marker: 'data-reka-date-field-segment', source: 'reka-ui' },
  { marker: 'preventOverflow', source: '@popperjs/core' },
  { marker: 'OES_texture_half_float', source: 'ui/BackgroundParticles.vue' },
  { marker: 'CwaLayoutSecondary:[]', source: 'cwa-component-group-declarations' },
  { marker: 'last_event_id', source: 'api/mercure-client.ts' },
  { marker: 'orphaned_resources/delete', source: 'api/orphaned-resource-requests.ts' },
  { marker: 'The page cache warm stopped before it finished', source: 'api/page-cache-warm.ts' },
  { marker: 'vuejs-confirm-dialog-root', source: 'vuejs-confirm-dialog' },
  { marker: 'The component being cloned no longer exists', source: 'admin/clone-component.ts' },
  { marker: 'were saved to a new draft', source: 'admin/remote-changes.ts' },
  { marker: 'Real-time presence is turned off on the API', source: 'admin/presence.ts' },
  { marker: 'Live editing paused', source: 'header/_parts/PresenceIndicator.vue' },
  { marker: 'cwa:z-peer-outline', source: 'resource-manager/PeerOutlines.vue' },
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
    console.log(`Entry modulepreload graph: ${chunks.length} chunks, ${raw} B raw, ${gzip} B gzip (budget ${gzipBudget} B)`)

    const found = []
    for (const { marker, source } of forbidden) {
      const hits = chunks.filter(chunk => chunk.contents.includes(marker)).map(chunk => chunk.name)
      console.log(`  ${hits.length ? 'FOUND  ' : 'absent '} ${source} (${marker})${hits.length ? ` in ${hits.join(', ')}` : ''}`)
      if (hits.length) {
        found.push({ source, marker, hits })
      }
    }

    if (found.length) {
      console.error('\nFAIL: admin-only, error-only or lazily loaded code is in the entry chunk graph every visitor downloads (#331, #382).')
      for (const { source, hits } of found) {
        console.error(`  ${source} -> ${hits.join(', ')}`)
      }
      process.exit(1)
    }

    if (gzip > gzipBudget) {
      console.error(`\nFAIL: the entry chunk graph is ${gzip} B gzip, over the ${gzipBudget} B budget (#382).`)
      process.exit(1)
    }

    console.log('\nPASS: no admin-only, error-only or lazily loaded marker in the entry modulepreload graph, within budget.')
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

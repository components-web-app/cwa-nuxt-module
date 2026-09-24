import { gzipSync } from 'node:zlib'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRendererContext, getRequestDependencies } from 'vue-bundle-renderer/runtime'

const here = dirname(fileURLToPath(import.meta.url))
const outputDir = resolve(here, '../../playground/.output')
const manifestPath = resolve(outputDir, 'server/chunks/virtual/precomputed.mjs')
const chunkDir = resolve(outputDir, 'public/_nuxt')

const layoutSource = 'layer/layouts/CwaRootLayout.vue'
const adminSources = [
  'runtime/templates/components/main/admin/',
  'runtime/templates/components/core/admin/',
]

const forbidden = [
  { marker: 'Sign out', source: 'admin/header/Header.vue' },
  { marker: 'Add Component', source: 'admin/resource-manager/ResourceManager.vue' },
]

const isAdminSource = key => adminSources.some(dir => key.includes(dir))

function fail(message) {
  console.error(`\nFAIL: ${message}`)
  process.exit(1)
}

async function main() {
  if (!existsSync(manifestPath)) {
    throw new Error(`No playground build at ${outputDir}. Run "pnpm run dev:build" first.`)
  }
  const precomputed = (await import(manifestPath)).default
  const layoutKey = Object.keys(precomputed.modules).find(key => key.endsWith(layoutSource))
  if (!layoutKey) {
    fail(`the client manifest has no entry for ${layoutSource}, so the rendered layout is not a prefetch root and this check would pass for the wrong reason (#336).`)
  }

  const adminKeys = Object.keys(precomputed.modules).filter(isAdminSource)
  if (!adminKeys.length) {
    fail('the client manifest has no admin component keys at all, so their absence from the prefetch set proves nothing (#336).')
  }
  const adminFiles = new Set(adminKeys.map(key => precomputed.modules[key].file))

  const ctx = createRendererContext({ precomputed, buildAssetsURL: file => file })
  const { prefetch } = getRequestDependencies({ modules: new Set([layoutKey]) }, ctx)

  const chunks = []
  let raw = 0
  let gzip = 0
  for (const [key, asset] of Object.entries(prefetch)) {
    const file = resolve(chunkDir, asset.file)
    if (!existsSync(file)) {
      throw new Error(`Manifest references a missing chunk: ${asset.file}`)
    }
    const contents = readFileSync(file, 'utf8')
    raw += contents.length
    gzip += gzipSync(contents, { level: 9 }).length
    chunks.push({ key, file: asset.file, contents })
  }
  console.log(`Prefetch hints for a rendered ${layoutSource}: ${chunks.length} files, ${raw} B raw, ${gzip} B gzip`)

  const admin = chunks.filter(chunk => isAdminSource(chunk.key) || adminFiles.has(chunk.file))
  const byMarker = []
  for (const { marker, source } of forbidden) {
    const hits = chunks.filter(chunk => chunk.contents.includes(marker))
    console.log(`  ${hits.length ? 'FOUND  ' : 'absent '} ${source} (${marker})${hits.length ? ` in ${hits.map(hit => hit.file).join(', ')}` : ''}`)
    if (hits.length) {
      byMarker.push({ source, hits })
    }
  }

  if (admin.length || byMarker.length) {
    console.error('\nFAIL: admin-only code is prefetched for every visitor through the root layout (#336).')
    for (const chunk of admin) {
      console.error(`  ${chunk.file} <- ${chunk.key}`)
    }
    for (const { source, hits } of byMarker) {
      console.error(`  ${source} -> ${hits.map(hit => hit.file).join(', ')}`)
    }
    process.exit(1)
  }

  console.log('\nPASS: no admin-only chunk in the root layout prefetch set.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

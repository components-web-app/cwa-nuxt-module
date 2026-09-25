import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const DECLARATION = /\.d\.(ts|mts|cts|vue\.ts)$/

export function findEmptyDeclarations(root) {
  return readdirSync(root, { recursive: true })
    .filter(file => DECLARATION.test(file))
    .filter((file) => {
      const stats = statSync(join(root, file))
      return stats.isFile() && stats.size === 0
    })
    .map(file => relative(root, join(root, file)))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? 'dist'
  const empty = findEmptyDeclarations(root)
  if (empty.length) {
    console.error(`Declaration emit produced empty files, so the build shipped no types for them:\n${empty.map(file => `  ${join(root, file)}`).join('\n')}\nLook for a TS error (often TS2883) in the build output above.`)
    process.exit(1)
  }
}

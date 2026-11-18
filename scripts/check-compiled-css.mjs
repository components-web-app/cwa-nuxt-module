import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const compiledCss = [
  { script: 'tailwind:main', source: 'src/tailwind/tailwind-cwa.css', committed: 'src/runtime/templates/assets/cwa.css' },
  { script: 'tailwind:base', source: 'src/tailwind/tailwind-base.css', committed: 'src/runtime/templates/assets/base.css' },
]

const postcssCli = createRequire(import.meta.url).resolve('postcss-cli')

export function findStaleCompiledCss(root, files = compiledCss) {
  const out = mkdtempSync(join(tmpdir(), 'cwa-compiled-css-'))
  try {
    return files.filter(({ source, committed }, index) => {
      const target = join(out, `${index}.css`)
      execFileSync(process.execPath, [postcssCli, source, '-o', target], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] })
      return readFileSync(target, 'utf8') !== readFileSync(resolve(root, committed), 'utf8')
    })
  }
  finally {
    rmSync(out, { recursive: true, force: true })
  }
}

export function staleMessage(stale) {
  return `The committed compiled CSS is out of date, so it does not hold every class the source uses:\n${stale.map(({ script, committed }) => `  ${committed}: run \`pnpm run ${script}\` and commit it`).join('\n')}`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const stale = findStaleCompiledCss(process.cwd())
  if (stale.length) {
    console.error(staleMessage(stale))
    process.exit(1)
  }
}

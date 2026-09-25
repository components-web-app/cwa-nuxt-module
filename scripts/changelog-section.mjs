import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export function extractChangelogSection(markdown, version) {
  const wanted = version.replace(/^v/, '')
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => {
    const match = line.match(/^## \[?([^\]\s]+)\]?/)
    return match?.[1] === wanted
  })
  if (start === -1) {
    return undefined
  }
  const body = []
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2} /.test(line) || /^\[[^\]]+\]: /.test(line)) {
      break
    }
    body.push(line)
  }
  const section = body.join('\n').trim()
  return section || undefined
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version, file = 'CHANGELOG.md'] = process.argv.slice(2)
  const section = version && extractChangelogSection(readFileSync(file, 'utf8'), version)
  if (!section) {
    console.error(`${file} has no entries under a "## [${version?.replace(/^v/, '')}]" heading.`)
    process.exit(1)
  }
  process.stdout.write(`${section}\n`)
}

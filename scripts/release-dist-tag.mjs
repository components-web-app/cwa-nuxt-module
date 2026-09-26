import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export function distTagFor(version, publishedVersions) {
  const preRelease = version.split('-')[1]
  if (!preRelease) {
    return 'latest'
  }
  const hasStable = publishedVersions.some(published => !published.includes('-'))
  return hasStable ? preRelease.split('.')[0] : 'latest'
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [name, version] = process.argv.slice(2)
  const published = JSON.parse(execFileSync('npm', ['view', name, 'versions', '--json'], { encoding: 'utf8' }) || '[]')
  process.stdout.write(`${distTagFor(version, [published].flat())}\n`)
}

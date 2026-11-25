import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const buildDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../playground/node_modules/.cache/nuxt/.nuxt')
let failures = 0

function read(file) {
  try {
    return readFileSync(resolve(buildDir, file), 'utf8')
  }
  catch {
    throw new Error(`No ${file} in ${buildDir}. Run "pnpm run dev:build" first.`)
  }
}

function check(label, passed) {
  console.log(`${passed ? 'ok   ' : 'WRONG'} ${label}`)
  if (!passed) {
    failures++
  }
}

console.log('#487 the fixture extension registers through cwa:extend\n')

check('its component is a CWA component name', read('cwa-component-names.ts').includes('"FixtureBadge": "FixtureBadge"'))
check('its component\'s defineCwaConfig is read', /"FixtureBadge": \{\s+"name": "Fixture badge"/.test(read('cwa-config.ts')))

const menu = read('cwa-extension-menu.ts')
check('its admin page is in the menu for admins', /"label": "Orders",\s+"to": \{\s+"name": "_cwa-fixture-orders"\s+\},\s+"role": "ROLE_ADMIN"/.test(menu))
check('its role-gated admin page is in the menu with its role', /"label": "Reports",\s+"to": \{\s+"name": "_cwa-fixture-reports"\s+\},\s+"role": "ROLE_FIXTURE_REPORTS"/.test(menu))

const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../playground/.output/public/_nuxt')
const clientCode = readdirSync(clientDir).filter(file => file.endsWith('.js')).map(file => readFileSync(resolve(clientDir, file), 'utf8')).join('\n')
check('its orders list has its order dialog as an item route', /name:\s*["'`]_cwa-fixture-orders-iri["'`],\s*path:\s*["'`]:iri["'`]/.test(clientCode))

console.log(`\nwrong: ${failures}`)
if (failures) {
  console.error('\nFAIL: the fixture extension did not register (#487).')
  process.exit(1)
}
console.log('\nPASS: the fixture extension registered its component, config and admin menu.')

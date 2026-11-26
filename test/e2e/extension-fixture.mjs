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

check('the header knows the roles its admin pages need', read('cwa-extension-menu.ts').includes('export const extensionPageRoles: string[] = ["ROLE_ADMIN","ROLE_FIXTURE_REPORTS"]'))
const areas = read('cwa-extension-areas.ts')
check('its area is listed with its label, description and lucide icon', /"segment": "fixture",\s+"label": "Fixture shop",\s+"description": "Orders and reports",\s+"icon": "<svg data-cwa-admin-icon/.test(areas))
check('its admin pages are the area\'s tabs, in order, with their roles', /"path": "orders",\s+"label": "Orders",\s+"role": "ROLE_ADMIN"\s+\},\s+\{\s+"path": "reports",\s+"label": "Reports",\s+"role": "ROLE_FIXTURE_REPORTS"/.test(areas))
const pageData = read('cwa-extension-page-data.ts')
check('its page-data tab is listed with its key, label, default role and property', pageData.includes('{ key: "formats", label: "Formats and prices", role: "ROLE_ADMIN", property: "variants", component: defineAsyncComponent(() => import('))
check('its page-data list is listed by its route name with its property and column', /"_cwa-fixture-products": \{ label: "Products", property: "variants", columns: \[\{ label: "From", component: defineAsyncComponent/.test(pageData))
check('its page-data list is an area tab after its admin pages', /"path": "reports",\s+"label": "Reports",\s+"role": "ROLE_FIXTURE_REPORTS"\s+\},\s+\{\s+"path": "products",\s+"label": "Products",\s+"role": "ROLE_ADMIN"/.test(areas))

const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../playground/.output/public/_nuxt')
const clientCode = readdirSync(clientDir).filter(file => file.endsWith('.js')).map(file => readFileSync(resolve(clientDir, file), 'utf8')).join('\n')
check('its area is a route under /_cwa named from its prefix', /name:\s*["'`]_cwa-fixture["'`],\s*path:\s*["'`]fixture["'`]/.test(clientCode))
check('its orders list is a route in its area', /name:\s*["'`]_cwa-fixture-orders["'`],\s*path:\s*["'`]orders["'`]/.test(clientCode))
check('its orders list has its order dialog as an item route', /name:\s*["'`]_cwa-fixture-orders-iri["'`],\s*path:\s*["'`]:iri["'`]/.test(clientCode))
check('its page-data list is a route in its area', /name:\s*["'`]_cwa-fixture-products["'`],\s*path:\s*["'`]products["'`]/.test(clientCode))
check('its page-data list has the page-data dialog as an item route', /name:\s*["'`]_cwa-fixture-products-iri["'`],\s*path:\s*["'`]:iri["'`]/.test(clientCode))

console.log(`\nwrong: ${failures}`)
if (failures) {
  console.error('\nFAIL: the fixture extension did not register (#487).')
  process.exit(1)
}
console.log('\nPASS: the fixture extension registered its component, config, admin area, page-data tab and list, and routes.')

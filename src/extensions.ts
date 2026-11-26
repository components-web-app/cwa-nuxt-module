import type { NuxtPage } from '@nuxt/schema'
import type { CwaExtensionArea } from './runtime/admin/extension-areas'

export interface CwaExtensionAdminPage {
  path: string
  label: string
  file: string
  item?: string
  role?: string
}

export interface CwaExtensionPageDataTab {
  key: string
  label: string
  file: string
  role?: string
  forTypesWithProperty: string
}

export interface CwaExtensionPageDataList {
  path: string
  label: string
  forTypesWithProperty: string
  role?: string
  columns?: { label: string, file: string }[]
}

export interface CwaExtension {
  name: string
  prefix: string
  label: string
  description?: string
  icon?: `lucide:${string}`
  dir?: string
  adminPages?: CwaExtensionAdminPage[]
  pageDataTabs?: CwaExtensionPageDataTab[]
  pageDataLists?: CwaExtensionPageDataList[]
  pageCache?: Record<string, false>
}

export interface ExtensionNames {
  components: string[]
  layouts: string[]
  pages: string[]
}

export const DEFAULT_ADMIN_ROLE = 'ROLE_ADMIN'

const KINDS = ['components', 'layouts', 'pages'] as const

const BUILT_IN_PAGE_DATA_TABS: Record<string, string> = { details: 'Details', routes: 'Routes', info: 'Info' }

export interface PageDataListFiles {
  list: string
  item: string
}

function areaPages(extension: CwaExtension, files: PageDataListFiles = { list: '', item: '' }): CwaExtensionAdminPage[] {
  return [
    ...extension.adminPages ?? [],
    ...(extension.pageDataLists ?? []).map(list => ({ path: list.path, label: list.label, role: list.role, file: files.list, item: files.item })),
  ]
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim()
}

function isAdminRole(role: string | undefined) {
  return role === undefined || (/^ROLE_[A-Z0-9_]+$/.test(role) && role !== 'ROLE_USER')
}

function trimPath(path: string) {
  return path.replace(/^\/+|\/+$/g, '')
}

export function extensionSegment(prefix: string) {
  return prefix.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase()
}

function adminRouteName(path: string) {
  return `_cwa-${trimPath(path).replace(/\//g, '-')}`
}

function namePath(dir: string | undefined, kind: typeof KINDS[number], name: string) {
  return `${dir ?? ''}/${kind}/${name}${kind === 'components' ? '' : '.vue'}`
}

export function checkExtensions({ extensions, namesOf, appNames, builtInAdminPaths }: {
  extensions: CwaExtension[]
  namesOf: (extension: CwaExtension) => ExtensionNames
  appNames: ExtensionNames
  builtInAdminPaths: string[]
}): { overrides: string[] } {
  const byName = new Map<string, CwaExtension>()
  const byPrefix = new Map<string, CwaExtension>()
  for (const extension of extensions) {
    if (byName.has(extension.name)) {
      throw new Error(`${extension.name} is registered twice`)
    }
    byName.set(extension.name, extension)
    const { prefix } = extension
    if (!/^[A-Z][A-Za-z0-9]*$/.test(prefix)) {
      throw new Error(`${extension.name}'s prefix "${prefix}" must be PascalCase letters and digits`)
    }
    if (prefix.startsWith('Cwa')) {
      throw new Error(`${extension.name}'s prefix "${prefix}" must not start with Cwa`)
    }
    const other = byPrefix.get(prefix)
    if (other) {
      throw new Error(`${other.name} and ${extension.name} both use the prefix "${prefix}"`)
    }
    byPrefix.set(prefix, extension)
  }

  const overrides: string[] = []
  for (const kind of KINDS) {
    const definedBy = new Map<string, CwaExtension>()
    for (const extension of extensions) {
      for (const name of namesOf(extension)[kind]) {
        if (!name.startsWith(extension.prefix) || name === extension.prefix) {
          throw new Error(`${namePath(extension.dir, kind, name)} from ${extension.name} must be named ${extension.prefix}<Name>, as ${extension.prefix}${name}`)
        }
        const first = definedBy.get(name)
        if (first) {
          throw new Error(`${name} is defined by both ${namePath(first.dir, kind, name)} (${first.name}) and ${namePath(extension.dir, kind, name)} (${extension.name})`)
        }
        definedBy.set(name, extension)
      }
    }
    for (const name of appNames[kind]) {
      const extension = definedBy.get(name)
      if (extension) {
        overrides.push(`${namePath('app/cwa', kind, name)} replaces ${name} from ${extension.name}`)
      }
    }
  }

  const segmentOwners = new Map<string, CwaExtension>()
  const routeOwners = new Map<string, string>()
  function claimRoute(path: string, extension: CwaExtension) {
    const name = adminRouteName(path)
    const other = routeOwners.get(name)
    if (other) {
      throw new Error(`/_cwa/${other} and /_cwa/${path} (${extension.name}) would both be the route ${name}`)
    }
    routeOwners.set(name, path)
  }
  for (const extension of extensions) {
    const pages = areaPages(extension)
    if (!pages.length) {
      continue
    }
    const segment = extensionSegment(extension.prefix)
    if (builtInAdminPaths.includes(segment)) {
      throw new Error(`${extension.name}'s admin area /_cwa/${segment}, from its prefix "${extension.prefix}", is a built-in admin page`)
    }
    const owner = segmentOwners.get(segment)
    if (owner) {
      throw new Error(`${owner.name} and ${extension.name} both have the admin area /_cwa/${segment}, from their prefixes "${owner.prefix}" and "${extension.prefix}"`)
    }
    segmentOwners.set(segment, extension)
    claimRoute(segment, extension)
    const ownPaths = new Set((extension.adminPages ?? []).map(page => trimPath(page.path)))
    for (const list of extension.pageDataLists ?? []) {
      const path = `${segment}/${trimPath(list.path)}`
      if (!hasText(list.forTypesWithProperty)) {
        throw new Error(`${extension.name}'s page-data list /_cwa/${path} needs forTypesWithProperty, the API property a page data type must have to be listed`)
      }
      if (ownPaths.has(trimPath(list.path))) {
        throw new Error(`${extension.name}'s page-data list /_cwa/${path} has the path of its own admin page /_cwa/${path}`)
      }
    }
    for (const page of pages) {
      const path = `${segment}/${trimPath(page.path)}`
      claimRoute(path, extension)
      if (typeof page.label !== 'string' || !page.label.trim()) {
        throw new Error(`${extension.name}'s admin page /_cwa/${path} needs a label for its tab`)
      }
      if (!isAdminRole(page.role)) {
        throw new Error(`${extension.name}'s admin page /_cwa/${path} declares the role "${page.role}". Use a ROLE_ name other than ROLE_USER, or leave it out for ${DEFAULT_ADMIN_ROLE}.`)
      }
    }
  }

  const tabOwners = new Map<string, CwaExtension>()
  for (const extension of extensions) {
    for (const tab of extension.pageDataTabs ?? []) {
      const builtIn = BUILT_IN_PAGE_DATA_TABS[tab.key]
      if (builtIn) {
        throw new Error(`${extension.name}'s page-data tab "${tab.key}" has the key of the built-in ${builtIn} tab`)
      }
      const owner = tabOwners.get(tab.key)
      if (owner) {
        throw new Error(owner === extension ? `${extension.name} has the page-data tab "${tab.key}" twice` : `${owner.name} and ${extension.name} both have the page-data tab "${tab.key}"`)
      }
      tabOwners.set(tab.key, extension)
      if (!hasText(tab.forTypesWithProperty)) {
        throw new Error(`${extension.name}'s page-data tab "${tab.key}" needs forTypesWithProperty, the API property a page data type must have to show it`)
      }
      if (!hasText(tab.label)) {
        throw new Error(`${extension.name}'s page-data tab "${tab.key}" needs a label`)
      }
      if (!isAdminRole(tab.role)) {
        throw new Error(`${extension.name}'s page-data tab "${tab.key}" declares the role "${tab.role}". Use a ROLE_ name other than ROLE_USER, or leave it out for ${DEFAULT_ADMIN_ROLE}.`)
      }
    }
  }

  return { overrides }
}

function pageRole(page: { role?: string }) {
  return page.role ?? DEFAULT_ADMIN_ROLE
}

export function extensionPageRoles(extensions: CwaExtension[]): string[] {
  return [...new Set(extensions.flatMap(extension => areaPages(extension).map(pageRole)))]
}

export function adminShellRoles(extensions: CwaExtension[]): string[] {
  return [...new Set(['ROLE_CMS_ADMIN', 'ROLE_USER_ADMIN', ...extensionPageRoles(extensions)])]
}

export function addExtensionAdminPages(pages: NuxtPage[], extensions: CwaExtension[], areaFile: string, listFiles: PageDataListFiles) {
  const parent = pages.find(page => page.path === '/_cwa')
  const extensionsPage = parent?.children?.find(page => page.path === 'extensions')
  if (extensionsPage) {
    extensionsPage.meta = { ...extensionsPage.meta, cwaAdminRole: [...new Set([DEFAULT_ADMIN_ROLE, ...extensionPageRoles(extensions)])] }
  }
  const accountPage = parent?.children?.find(page => page.path === 'account')
  if (accountPage) {
    accountPage.meta = { ...accountPage.meta, cwaAdminRole: adminShellRoles(extensions) }
  }
  const withPages = extensions.filter(extension => areaPages(extension).length)
  if (!withPages.length) {
    return
  }
  if (!parent) {
    throw new Error(`${withPages[0]!.name}'s admin pages need the /_cwa page from @cwa/nuxt/layer`)
  }
  parent.children ??= []
  for (const extension of withPages) {
    const segment = extensionSegment(extension.prefix)
    parent.children.push({
      path: segment,
      name: adminRouteName(segment),
      file: areaFile,
      meta: { cwaAdminRole: extensionPageRoles([extension]), middleware: ['cwa-extension-area'], pageTransition: false },
      children: areaPages(extension, listFiles).map((page) => {
        const name = adminRouteName(`${segment}/${trimPath(page.path)}`)
        const cwaAdminRole = pageRole(page)
        return {
          path: trimPath(page.path),
          name,
          file: page.file,
          meta: { cwaAdminRole },
          ...(page.item ? { children: [{ path: ':iri', name: `${name}-iri`, file: page.item, meta: { cwaAdminRole, key: `${name}-iri` } }] } : {}),
        }
      }),
    })
  }
}

export function extensionAreas(extensions: CwaExtension[], iconSvg: (icon: string) => string | undefined): CwaExtensionArea[] {
  return extensions.map((extension) => {
    const icon = extension.icon && iconSvg(extension.icon)
    return {
      segment: extensionSegment(extension.prefix),
      label: extension.label,
      ...(extension.description ? { description: extension.description } : {}),
      ...(icon ? { icon } : {}),
      pages: areaPages(extension).map(page => ({ path: trimPath(page.path), label: page.label, role: pageRole(page) })),
    }
  })
}

export function extensionAdminRoles(extensions: CwaExtension[]): { role: string, label: string }[] {
  const labels = new Map<string, string[]>()
  for (const page of extensions.flatMap(extension => [...areaPages(extension), ...extension.pageDataTabs ?? []])) {
    if (!page.role || page.role === DEFAULT_ADMIN_ROLE) {
      continue
    }
    labels.set(page.role, [...labels.get(page.role) ?? [], page.label])
  }
  return [...labels].map(([role, pageLabels]) => ({ role, label: pageLabels.join(', ') }))
}

export function extensionPageDataTemplate(extensions: CwaExtension[]) {
  const component = (file: string) => `defineAsyncComponent(() => import(${JSON.stringify(file)}))`
  const tabs = extensions.flatMap(extension => (extension.pageDataTabs ?? []).map(tab => `  { key: ${JSON.stringify(tab.key)}, label: ${JSON.stringify(tab.label)}, role: ${JSON.stringify(pageRole(tab))}, property: ${JSON.stringify(tab.forTypesWithProperty)}, component: ${component(tab.file)} },\n`))
  const lists = extensions.flatMap(extension => (extension.pageDataLists ?? []).map((list) => {
    const columns = (list.columns ?? []).map(column => `{ label: ${JSON.stringify(column.label)}, component: ${component(column.file)} }`)
    return `  ${JSON.stringify(adminRouteName(`${extensionSegment(extension.prefix)}/${trimPath(list.path)}`))}: { label: ${JSON.stringify(list.label)}, property: ${JSON.stringify(list.forTypesWithProperty)}, columns: [${columns.join(', ')}] },\n`
  }))
  return `import { defineAsyncComponent } from 'vue'
import type { ExtensionPageDataList, ExtensionPageDataTab } from '#cwa/admin/extension-page-data'
export const extensionPageDataTabs: ExtensionPageDataTab[] = [
${tabs.join('')}]
export const extensionPageDataLists: Record<string, ExtensionPageDataList> = {
${lists.join('')}}
`
}

export function extensionRouteRules(routeRules: Record<string, Record<string, unknown>>, extensions: CwaExtension[]) {
  for (const extension of extensions) {
    for (const [path, pageCache] of Object.entries(extension.pageCache ?? {})) {
      const rule = routeRules[path] ?? {}
      const cwa = (rule.cwa ?? {}) as Record<string, unknown>
      if ('pageCache' in cwa) {
        continue
      }
      routeRules[path] = { ...rule, cwa: { ...cwa, pageCache } }
    }
  }
}

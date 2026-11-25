import type { NuxtPage } from '@nuxt/schema'

export interface CwaExtensionAdminPage {
  path: string
  file: string
  item?: string
  role?: string
  menu?: { label: string }
}

export interface CwaExtension {
  name: string
  prefix: string
  dir?: string
  adminPages?: CwaExtensionAdminPage[]
  pageCache?: Record<string, false>
}

export interface ExtensionNames {
  components: string[]
  layouts: string[]
  pages: string[]
}

export interface CwaExtensionMenuEntry {
  label: string
  to: { name: string }
  role: string
}

export const DEFAULT_ADMIN_ROLE = 'ROLE_ADMIN'

const KINDS = ['components', 'layouts', 'pages'] as const

function trimPath(path: string) {
  return path.replace(/^\/+|\/+$/g, '')
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

  const adminPathOwners = new Map<string, CwaExtension>()
  for (const extension of extensions) {
    for (const page of extension.adminPages ?? []) {
      const path = trimPath(page.path)
      if (builtInAdminPaths.includes(path.split('/')[0]!)) {
        throw new Error(`${extension.name}'s admin page /_cwa/${path} is a built-in admin page`)
      }
      const owner = adminPathOwners.get(path)
      if (owner) {
        throw new Error(`/_cwa/${path} is registered by both ${owner.name} and ${extension.name}`)
      }
      adminPathOwners.set(path, extension)
      if (page.role !== undefined && (!/^ROLE_[A-Z0-9_]+$/.test(page.role) || page.role === 'ROLE_USER')) {
        throw new Error(`${extension.name}'s admin page /_cwa/${path} declares the role "${page.role}". Use a ROLE_ name other than ROLE_USER, or leave it out for ${DEFAULT_ADMIN_ROLE}.`)
      }
    }
  }

  return { overrides }
}

export function addExtensionAdminPages(pages: NuxtPage[], extensions: CwaExtension[]) {
  const withPages = extensions.filter(extension => extension.adminPages?.length)
  if (!withPages.length) {
    return
  }
  const parent = pages.find(page => page.path === '/_cwa')
  if (!parent) {
    throw new Error(`${withPages[0]!.name}'s admin pages need the /_cwa page from @cwa/nuxt/layer`)
  }
  parent.children ??= []
  for (const extension of withPages) {
    for (const page of extension.adminPages!) {
      const name = adminRouteName(page.path)
      const cwaAdminRole = page.role ?? DEFAULT_ADMIN_ROLE
      parent.children.push({
        path: trimPath(page.path),
        name,
        file: page.file,
        meta: { cwaAdminRole },
        ...(page.item ? { children: [{ path: ':iri', name: `${name}-iri`, file: page.item, meta: { cwaAdminRole, key: `${name}-iri` } }] } : {}),
      })
    }
  }
}

export function extensionAdminMenu(extensions: CwaExtension[]): CwaExtensionMenuEntry[] {
  return extensions.flatMap(extension => (extension.adminPages ?? [])
    .filter(page => page.menu)
    .map(page => ({ label: page.menu!.label, to: { name: adminRouteName(page.path) }, role: page.role ?? DEFAULT_ADMIN_ROLE })))
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

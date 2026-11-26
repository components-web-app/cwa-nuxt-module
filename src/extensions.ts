import type { NuxtPage } from '@nuxt/schema'
import type { CwaExtensionArea } from './runtime/admin/extension-areas'

export interface CwaExtensionAdminPage {
  path: string
  label: string
  file: string
  item?: string
  role?: string
}

export interface CwaExtension {
  name: string
  prefix: string
  label: string
  description?: string
  icon?: `lucide:${string}`
  dir?: string
  adminPages?: CwaExtensionAdminPage[]
  pageCache?: Record<string, false>
}

export interface ExtensionNames {
  components: string[]
  layouts: string[]
  pages: string[]
}

export const DEFAULT_ADMIN_ROLE = 'ROLE_ADMIN'

const KINDS = ['components', 'layouts', 'pages'] as const

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
    if (!extension.adminPages?.length) {
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
    for (const page of extension.adminPages) {
      const path = `${segment}/${trimPath(page.path)}`
      claimRoute(path, extension)
      if (typeof page.label !== 'string' || !page.label.trim()) {
        throw new Error(`${extension.name}'s admin page /_cwa/${path} needs a label for its tab`)
      }
      if (page.role !== undefined && (!/^ROLE_[A-Z0-9_]+$/.test(page.role) || page.role === 'ROLE_USER')) {
        throw new Error(`${extension.name}'s admin page /_cwa/${path} declares the role "${page.role}". Use a ROLE_ name other than ROLE_USER, or leave it out for ${DEFAULT_ADMIN_ROLE}.`)
      }
    }
  }

  return { overrides }
}

function pageRole(page: CwaExtensionAdminPage) {
  return page.role ?? DEFAULT_ADMIN_ROLE
}

export function extensionPageRoles(extensions: CwaExtension[]): string[] {
  return [...new Set(extensions.flatMap(extension => (extension.adminPages ?? []).map(pageRole)))]
}

export function addExtensionAdminPages(pages: NuxtPage[], extensions: CwaExtension[], areaFile: string) {
  const parent = pages.find(page => page.path === '/_cwa')
  const extensionsPage = parent?.children?.find(page => page.path === 'extensions')
  if (extensionsPage) {
    extensionsPage.meta = { ...extensionsPage.meta, cwaAdminRole: [...new Set([DEFAULT_ADMIN_ROLE, ...extensionPageRoles(extensions)])] }
  }
  const withPages = extensions.filter(extension => extension.adminPages?.length)
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
      children: extension.adminPages!.map((page) => {
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
      pages: (extension.adminPages ?? []).map(page => ({ path: trimPath(page.path), label: page.label, role: pageRole(page) })),
    }
  })
}

export function extensionAdminRoles(extensions: CwaExtension[]): { role: string, label: string }[] {
  const labels = new Map<string, string[]>()
  for (const page of extensions.flatMap(extension => extension.adminPages ?? [])) {
    if (!page.role || page.role === DEFAULT_ADMIN_ROLE) {
      continue
    }
    labels.set(page.role, [...labels.get(page.role) ?? [], page.label])
  }
  return [...labels].map(([role, pageLabels]) => ({ role, label: pageLabels.join(', ') }))
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

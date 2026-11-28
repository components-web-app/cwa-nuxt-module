import type { RouteLocationRaw } from 'vue-router'
import { extensionRouteName, openablePages } from './extension-areas'
import type { CwaExtensionArea } from './extension-areas'
import type Cwa from '#cwa/cwa'

export interface TopBarItem {
  id: string
  label: string
  to: RouteLocationRaw
  icon?: string
}

export interface AdminArea extends TopBarItem {
  description?: string
}

export interface AreaAccess {
  hasRole: (role: string) => boolean
  hasPageData: boolean
}

interface TopBarEntry {
  item: TopBarItem
  description?: string
  inTopBar: boolean
  isDefault: boolean
  allowed: (access: AreaAccess) => boolean
}

const BUILT_IN: { id: string, label: string, role: string, description: string }[] = [
  { id: 'layouts', label: 'Layouts', role: 'ROLE_CMS_ADMIN', description: 'The shared layouts around your pages.' },
  { id: 'pages', label: 'Pages', role: 'ROLE_CMS_ADMIN', description: 'Pages and the templates that page data uses.' },
  { id: 'data', label: 'Data', role: 'ROLE_CMS_ADMIN', description: 'Page data, such as articles, shown through a template.' },
  { id: 'routes', label: 'Routes', role: 'ROLE_CMS_ADMIN', description: 'The site\'s addresses and redirects.' },
  { id: 'users', label: 'Users', role: 'ROLE_USER_ADMIN', description: 'Who can sign in, and their roles.' },
]

function entries(areas: CwaExtensionArea[]): TopBarEntry[] {
  return [
    ...BUILT_IN.map(({ id, label, role, description }) => ({
      item: { id, label, to: `/_cwa/${id}` },
      description,
      inTopBar: true,
      isDefault: true,
      allowed: (access: AreaAccess) => access.hasRole(role) && (id !== 'data' || access.hasPageData),
    })),
    ...areas.filter(area => area.pages.length).map(area => ({
      item: { id: `ext:${area.segment}`, label: area.label, to: { name: extensionRouteName(area.segment) }, ...(area.icon ? { icon: area.icon } : {}) },
      description: area.description,
      inTopBar: !!area.icon,
      isDefault: !!area.topBar,
      allowed: (access: AreaAccess) => openablePages(area, access.hasRole).length > 0,
    })),
  ]
}

function topBarEntries(areas: CwaExtensionArea[]) {
  return entries(areas).filter(entry => entry.inTopBar)
}

export interface TopBarLists {
  own?: unknown
  developer?: string[]
}

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(id => typeof id === 'string')
}

function shownEntries(all: TopBarEntry[], { own, developer }: TopBarLists) {
  const chosen = isIdList(own) ? own : developer
  if (!chosen) {
    return all.filter(entry => entry.isDefault)
  }
  return [...new Set(chosen)].flatMap(id => all.filter(entry => entry.item.id === id))
}

export function topBarItems(areas: CwaExtensionArea[], lists: TopBarLists, access: AreaAccess): TopBarItem[] {
  return shownEntries(topBarEntries(areas), lists).filter(entry => entry.allowed(access)).map(entry => entry.item)
}

export function adminAreas(areas: CwaExtensionArea[], access: AreaAccess): AdminArea[] {
  return entries(areas).filter(entry => entry.allowed(access)).map(entry => entry.description ? { ...entry.item, description: entry.description } : entry.item)
}

export function topBarChoices(areas: CwaExtensionArea[], lists: TopBarLists): { item: TopBarItem, shown: boolean }[] {
  const all = topBarEntries(areas)
  const shown = shownEntries(all, lists)
  return [
    ...shown.map(entry => ({ item: entry.item, shown: true })),
    ...all.filter(entry => !shown.includes(entry)).map(entry => ({ item: entry.item, shown: false })),
  ]
}

export function unknownTopBarIds(ids: string[], areas: CwaExtensionArea[]) {
  const known = new Set(topBarEntries(areas).map(entry => entry.item.id))
  return ids.filter(id => !known.has(id))
}

export function fitTopBar(widths: number[], available: number, { active, more }: { active: number, more: number }) {
  const all = widths.map((_, index) => index)
  const total = widths.reduce((sum, width) => sum + width, 0)
  if (total <= available) {
    return { shown: all, overflow: [] }
  }
  const room = available - more
  const shown: number[] = []
  let used = 0
  for (const index of all) {
    if (used + widths[index]! > room) {
      break
    }
    shown.push(index)
    used += widths[index]!
  }
  if (active >= 0 && !shown.includes(active)) {
    while (shown.length && used + widths[active]! > room) {
      used -= widths[shown.pop()!]!
    }
    if (used + widths[active]! <= room) {
      shown.push(active)
    }
  }
  return { shown, overflow: all.filter(index => !shown.includes(index)) }
}

export function currentArea(items: { id: string, path: string }[], path: string) {
  return items.find(item => path === item.path || path.startsWith(`${item.path}/`))?.id
}

export function bottomBar<T>(items: T[]) {
  return { shown: items.slice(0, 3), more: items.slice(3) }
}

const sitePaths = new WeakMap<Cwa, string>()

export function rememberSitePath($cwa: Cwa, path: string) {
  sitePaths.set($cwa, path)
}

export function sitePath($cwa: Cwa) {
  return sitePaths.get($cwa) ?? '/'
}

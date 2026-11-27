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

interface TopBarEntry {
  item: TopBarItem
  isDefault: boolean
  allowed: (hasRole: (role: string) => boolean) => boolean
}

const BUILT_IN: { id: string, label: string, role: string }[] = [
  { id: 'layouts', label: 'Layouts', role: 'ROLE_CMS_ADMIN' },
  { id: 'pages', label: 'Pages', role: 'ROLE_CMS_ADMIN' },
  { id: 'data', label: 'Data', role: 'ROLE_CMS_ADMIN' },
  { id: 'routes', label: 'Routes', role: 'ROLE_CMS_ADMIN' },
  { id: 'users', label: 'Users', role: 'ROLE_USER_ADMIN' },
]

function entries(areas: CwaExtensionArea[]): TopBarEntry[] {
  return [
    ...BUILT_IN.map(({ id, label, role }) => ({
      item: { id, label, to: `/_cwa/${id}` },
      isDefault: true,
      allowed: (hasRole: (role: string) => boolean) => hasRole(role),
    })),
    ...areas.filter(area => area.icon && area.pages.length).map(area => ({
      item: { id: `ext:${area.segment}`, label: area.label, to: { name: extensionRouteName(area.segment) }, icon: area.icon },
      isDefault: !!area.topBar,
      allowed: (hasRole: (role: string) => boolean) => openablePages(area, hasRole).length > 0,
    })),
  ]
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

export function topBarItems(areas: CwaExtensionArea[], lists: TopBarLists, hasRole: (role: string) => boolean): TopBarItem[] {
  return shownEntries(entries(areas), lists).filter(entry => entry.allowed(hasRole)).map(entry => entry.item)
}

export function topBarChoices(areas: CwaExtensionArea[], lists: TopBarLists): { item: TopBarItem, shown: boolean }[] {
  const all = entries(areas)
  const shown = shownEntries(all, lists)
  return [
    ...shown.map(entry => ({ item: entry.item, shown: true })),
    ...all.filter(entry => !shown.includes(entry)).map(entry => ({ item: entry.item, shown: false })),
  ]
}

export function unknownTopBarIds(ids: string[], areas: CwaExtensionArea[]) {
  const known = new Set(entries(areas).map(entry => entry.item.id))
  return ids.filter(id => !known.has(id))
}

const sitePaths = new WeakMap<Cwa, string>()

export function rememberSitePath($cwa: Cwa, path: string) {
  sitePaths.set($cwa, path)
}

export function sitePath($cwa: Cwa) {
  return sitePaths.get($cwa) ?? '/'
}

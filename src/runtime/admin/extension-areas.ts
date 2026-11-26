export interface CwaExtensionArea {
  segment: string
  label: string
  description?: string
  icon?: string
  pages: { path: string, label: string, role: string }[]
}

export function extensionRouteName(segment: string, page?: string) {
  return `_cwa-${page ? `${segment}/${page}` : segment}`.replace(/\//g, '-')
}

export function openablePages(area: CwaExtensionArea, hasRole: (role: string) => boolean) {
  return area.pages.filter(page => hasRole(page.role))
}

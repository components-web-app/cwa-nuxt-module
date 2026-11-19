import type { Router } from 'vue-router'
import type Cwa from '#cwa/cwa'

export type PageLink
  = | { kind: 'internal', path: string }
    | { kind: 'external', href: string }
    | { kind: 'section', hash: string }

export function pageLinkOf(anchor: HTMLAnchorElement, base = ''): PageLink {
  const url = new URL(anchor.href, window.location.href)
  if (anchor.target === '_blank' || url.origin !== window.location.origin) {
    return { kind: 'external', href: url.href }
  }
  if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) {
    return { kind: 'section', hash: url.hash }
  }
  const pathname = base && url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length) : url.pathname
  return { kind: 'internal', path: `${pathname}${url.search}${url.hash}` }
}

export function pageLinkLabel(link: PageLink) {
  if (link.kind === 'internal') {
    return `Visit ${link.path}`
  }
  return link.kind === 'external' ? 'Open in new tab ↗' : 'Go to section'
}

export async function followPageLink($cwa: Cwa, router: Router, link: PageLink) {
  if (link.kind === 'external') {
    window.open(link.href, '_blank', 'noopener')
    return
  }
  if (link.kind === 'section') {
    document.getElementById(decodeURIComponent(link.hash.slice(1)))?.scrollIntoView()
    return
  }
  const to = router.resolve(link.path)
  await $cwa.resourcesManager.flushPendingUpdates()
  $cwa.admin.visitPath = to.path
  await router.push({ path: to.path, query: { ...to.query, cwa_force: 'true' }, hash: to.hash })
}

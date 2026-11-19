// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { followPageLink, pageLinkLabel, pageLinkOf } from './page-link'
import type Cwa from '#cwa/cwa'

function anchor(href: string, attributes: Record<string, string> = {}) {
  const element = document.createElement('a')
  element.setAttribute('href', href)
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value))
  document.body.append(element)
  return element
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:any(.*)*', component: { render: () => null } }],
  })
}

afterEach(() => {
  document.body.innerHTML = ''
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
})

describe('pageLinkOf', () => {
  test('a link to another page on this site is visited at its path, query and hash', () => {
    window.history.replaceState(null, '', '/current')
    expect(pageLinkOf(anchor('/blog/post?tag=a#comments'))).toEqual({ kind: 'internal', path: '/blog/post?tag=a#comments' })
  })

  test('the app\'s base URL is not part of the path visited, as the router adds it', () => {
    expect(pageLinkOf(anchor('/base/blog/post'), '/base')).toEqual({ kind: 'internal', path: '/blog/post' })
  })

  test('a link to another site opens in a new tab', () => {
    expect(pageLinkOf(anchor('https://example.com/elsewhere'))).toEqual({ kind: 'external', href: 'https://example.com/elsewhere' })
  })

  test('a link that opens in a new tab still does, even on this site', () => {
    expect(pageLinkOf(anchor('/blog/post', { target: '_blank' }))).toEqual({ kind: 'external', href: `${window.location.origin}/blog/post` })
  })

  test('a link to a section of the page on screen goes to that section', () => {
    window.history.replaceState(null, '', '/current?x=1')
    expect(pageLinkOf(anchor('#contact'))).toEqual({ kind: 'section', hash: '#contact' })
    expect(pageLinkOf(anchor('/current?x=1#team'))).toEqual({ kind: 'section', hash: '#team' })
  })
})

describe('pageLinkLabel', () => {
  test.each([
    [{ kind: 'internal', path: '/blog/post' }, 'Visit /blog/post'],
    [{ kind: 'external', href: 'https://example.com' }, 'Open in new tab ↗'],
    [{ kind: 'section', hash: '#contact' }, 'Go to section'],
  ] as const)('%o reads %s', (link, label) => {
    expect(pageLinkLabel(link)).toBe(label)
  })
})

describe('followPageLink', () => {
  function makeCwa() {
    return {
      admin: { visitPath: undefined as string | undefined },
      resourcesManager: { flushPendingUpdates: vi.fn(async () => {}) },
    }
  }

  test('a visit sends waiting saves, passes the editing guard and follows the route\'s redirect, staying in edit mode', async () => {
    const router = makeRouter()
    await router.push('/current')
    const $cwa = makeCwa()
    const order: string[] = []
    $cwa.resourcesManager.flushPendingUpdates.mockImplementation(async () => {
      order.push('flush')
    })
    router.beforeEach((to) => {
      order.push(`navigate ${to.fullPath}`)
      expect($cwa.admin.visitPath).toBe('/old')
    })

    await followPageLink($cwa as unknown as Cwa, router, { kind: 'internal', path: '/old?tag=a#top' })

    expect(order).toEqual(['flush', 'navigate /old?tag=a&cwa_force=true#top'])
  })

  test('a link to another site opens in a new tab without access to this one', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const router = makeRouter()
    const push = vi.spyOn(router, 'push')

    followPageLink(makeCwa() as unknown as Cwa, router, { kind: 'external', href: 'https://example.com/' })

    expect(open).toHaveBeenCalledWith('https://example.com/', '_blank', 'noopener')
    expect(push).not.toHaveBeenCalled()
  })

  test('a section link scrolls to the element it names, without navigating', () => {
    const section = document.createElement('section')
    section.id = 'our team'
    document.body.append(section)
    const scrollIntoView = vi.fn()
    section.scrollIntoView = scrollIntoView
    const router = makeRouter()
    const push = vi.spyOn(router, 'push')

    followPageLink(makeCwa() as unknown as Cwa, router, { kind: 'section', hash: '#our%20team' })

    expect(scrollIntoView).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })
})

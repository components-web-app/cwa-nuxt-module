// @vitest-environment happy-dom

import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'

import { useHtmlContent } from '#cwa/composables/component/html-content'

// ---------------------------------------------------------------------------
// Hoisted capture targets
// ---------------------------------------------------------------------------
const mounted = vi.hoisted(() => ({ cb: undefined as undefined | (() => void) }))
const beforeUnmount = vi.hoisted(() => ({ cb: undefined as undefined | (() => void) }))
const createdApps = vi.hoisted(() => ({ list: [] as any[] }))
const lastRender = vi.hoisted(() => ({ props: undefined as any }))
const mockRouter = vi.hoisted(() => ({ value: { name: 'mock-router' } }))

// ---------------------------------------------------------------------------
// Mock vue: capture lifecycle callbacks and stub createApp
// ---------------------------------------------------------------------------
vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    onMounted: vi.fn((fn: () => void) => {
      mounted.cb = fn
    }),
    onBeforeUnmount: vi.fn((fn: () => void) => {
      beforeUnmount.cb = fn
    }),
    createApp: vi.fn((options: any) => {
      // Execute the render function so we capture the props passed to CwaLink
      if (typeof options.render === 'function') {
        try {
          options.render()
        }
        catch {
          // render may reference h() result internals; ignore
        }
      }
      const app = {
        _options: options,
        use: vi.fn(() => app),
        mount: vi.fn(),
        unmount: vi.fn(),
      }
      createdApps.list.push(app)
      return app
    }),
    h: vi.fn((comp: any, props: any) => {
      // Capture the props passed to the first (CwaLink) call so we can assert on `to`
      if (props && 'to' in props) {
        lastRender.props = props
      }
      return { comp, props }
    }),
  }
})

vi.mock('vue-router', async () => {
  const mod = await vi.importActual<typeof import('vue-router')>('vue-router')
  return { ...mod, useRouter: () => mockRouter.value }
})

describe('useHtmlContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mounted.cb = undefined
    beforeUnmount.cb = undefined
    createdApps.list = []
    lastRender.props = undefined
  })

  function setupContainer(innerHtml: string) {
    const el = document.createElement('div')
    el.innerHTML = innerHtml
    return ref<HTMLElement | null>(el)
  }

  test('registers onMounted and onBeforeUnmount lifecycle hooks', () => {
    const container = ref<HTMLElement | null>(null)
    useHtmlContent(container)
    expect(mounted.cb).toBeTypeOf('function')
    expect(beforeUnmount.cb).toBeTypeOf('function')
  })

  test('does nothing when container has no element (no getElementsByTagName)', () => {
    const container = ref<HTMLElement | null>(null)
    useHtmlContent(container)
    mounted.cb?.()
    expect(createdApps.list).toHaveLength(0)
  })

  test('replaces an anchor with a mounted CwaLink app', () => {
    const container = setupContainer('<a href="/internal-page">Click me</a>')
    useHtmlContent(container)
    mounted.cb?.()

    expect(createdApps.list).toHaveLength(1)
    // router is registered
    expect(createdApps.list[0].use).toHaveBeenCalledWith(mockRouter.value)
    // app is mounted into a span replacing the anchor
    expect(createdApps.list[0].mount).toHaveBeenCalledTimes(1)
    // The original anchor is gone, replaced by a span
    expect(container.value?.getElementsByTagName('a')).toHaveLength(0)
    expect(container.value?.getElementsByTagName('span').length).toBeGreaterThan(0)
  })

  test('skips anchors without an href', () => {
    const container = setupContainer('<a>no href</a>')
    useHtmlContent(container)
    mounted.cb?.()
    expect(createdApps.list).toHaveLength(0)
    // anchor remains untouched
    expect(container.value?.getElementsByTagName('a')).toHaveLength(1)
  })

  test('strips origin for same-host absolute URLs', () => {
    const host = window.location.hostname
    const container = setupContainer(`<a href="https://${host}:9999/path?x=1#frag">link</a>`)
    useHtmlContent(container)
    mounted.cb?.()
    expect(lastRender.props.to).toBe('/path?x=1#frag')
  })

  test('keeps full URL for external hosts', () => {
    const container = setupContainer('<a href="https://external.example.com/foo">link</a>')
    useHtmlContent(container)
    mounted.cb?.()
    expect(lastRender.props.to).toBe('https://external.example.com/foo')
  })

  test('keeps absolute root-relative paths as-is', () => {
    const container = setupContainer('<a href="/already/relative">link</a>')
    useHtmlContent(container)
    mounted.cb?.()
    expect(lastRender.props.to).toBe('/already/relative')
  })

  test('prefixes bare words (e.g. lipsum "0") with // to treat as external', () => {
    const container = setupContainer('<a href="0">bad link</a>')
    useHtmlContent(container)
    mounted.cb?.()
    expect(lastRender.props.to).toBe('//0')
  })

  test('copies non-href/target attributes onto link props and ignores empty ones', () => {
    const container = setupContainer('<a href="/p" class="my-class" data-foo="bar" target="_blank" title="">x</a>')
    useHtmlContent(container)
    mounted.cb?.()
    const props = lastRender.props
    expect(props.class).toBe('my-class')
    expect(props['data-foo']).toBe('bar')
    // target is excluded
    expect(props.target).toBeUndefined()
    // empty title is not copied
    expect(props.title).toBeUndefined()
    // default link props present
    expect(props.prefetch).toBe(false)
  })

  test('processes multiple anchors in the container', () => {
    const container = setupContainer('<a href="/one">1</a><p><a href="/two">2</a></p>')
    useHtmlContent(container)
    mounted.cb?.()
    expect(createdApps.list).toHaveLength(2)
    expect(container.value?.getElementsByTagName('a')).toHaveLength(0)
  })

  test('re-runs replacement when container ref changes', async () => {
    const container = ref<HTMLElement | null>(null)
    useHtmlContent(container)
    mounted.cb?.() // sets up the watcher (immediate runs once with null -> no-op)
    expect(createdApps.list).toHaveLength(0)

    const el = document.createElement('div')
    el.innerHTML = '<a href="/changed">link</a>'
    container.value = el
    await nextTick()
    expect(createdApps.list).toHaveLength(1)
  })

  test('onBeforeUnmount stops the watcher', async () => {
    const container = ref<HTMLElement | null>(null)
    useHtmlContent(container)
    mounted.cb?.()
    beforeUnmount.cb?.()

    // after unmount, changing the container should not trigger replacement
    const el = document.createElement('div')
    el.innerHTML = '<a href="/after-unmount">link</a>'
    container.value = el
    await nextTick()
    expect(createdApps.list).toHaveLength(0)
  })

  test('does not mount when anchor has no parent node', () => {
    const container = setupContainer('<a href="/p">x</a>')
    // detach the anchor so it has no parentNode at replacement time
    const anchor = container.value!.getElementsByTagName('a')[0]
    container.value!.removeChild(anchor)
    // re-insert into a getElementsByTagName-discoverable place is impossible without parent,
    // so instead stub getElementsByTagName to return the orphan anchor
    const orphan = document.createElement('a')
    orphan.setAttribute('href', '/p')
    vi.spyOn(container.value!, 'getElementsByTagName').mockReturnValue([orphan] as any)

    useHtmlContent(container)
    mounted.cb?.()
    // app created (convertAnchor succeeds) but not mounted (no parent)
    expect(createdApps.list).toHaveLength(1)
    expect(createdApps.list[0].mount).not.toHaveBeenCalled()
  })
})

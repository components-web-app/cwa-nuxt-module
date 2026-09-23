// @vitest-environment happy-dom

import { afterEach, describe, expect, test, vi } from 'vitest'
import { createApp, createElementVNode, createSSRApp, defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import type { DirectiveBinding, Ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { vCwaHtml } from '#cwa/directives/cwa-html'
import { useHtmlContent } from '#cwa/composables/component/html-content'

vi.mock('vue-router', () => ({
  useRouter: () => ({}),
}))

const LCP_HTML = '<p id="lcp">The largest paragraph on this page, rendered by the server.</p><p>second</p>'

function ssrPropsFor(value: string | undefined) {
  return vCwaHtml.getSSRProps!({ value } as unknown as DirectiveBinding<string | undefined>, undefined as never)
}

async function serverRender(html: string) {
  return await renderToString(createSSRApp(defineComponent({
    render: () => h('div', { class: 'prose', innerHTML: html }),
  })))
}

function directiveComponent(html: string) {
  return defineComponent({
    render: () => withDirectives(createElementVNode('div', { class: 'prose' }, null, 512), [[vCwaHtml, html]]),
  })
}

function vHtmlComponent(html: string) {
  return defineComponent({
    render: () => createElementVNode('div', { class: 'prose', innerHTML: html }, null, 8, ['innerHTML']),
  })
}

async function hydrate(component: ReturnType<typeof directiveComponent>, html = LCP_HTML) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  container.innerHTML = await serverRender(html)

  const serverElement = container.querySelector('#lcp')!
  const serverText = serverElement.firstChild!

  createSSRApp(component).mount(container)

  const hydratedElement = container.querySelector('#lcp')
  return {
    serverElement,
    survived: hydratedElement === serverElement,
    textSurvived: hydratedElement?.firstChild === serverText,
    renderedHtml: (container.firstElementChild as HTMLElement).innerHTML,
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('vCwaHtml', () => {
  test('the server-rendered paragraph is still the same DOM node after hydration', async () => {
    const result = await hydrate(directiveComponent(LCP_HTML))

    expect(result.survived).toBe(true)
    expect(result.textSurvived).toBe(true)
    expect(result.serverElement.isConnected).toBe(true)
    expect(result.renderedHtml).toBe(LCP_HTML)
  })

  test('v-html destroys the server-rendered paragraph, which is the reason this directive exists', async () => {
    const result = await hydrate(vHtmlComponent(LCP_HTML))

    expect(result.survived).toBe(false)
    expect(result.serverElement.isConnected).toBe(false)
    expect(result.renderedHtml).toBe(LCP_HTML)
  })

  test('hydration reports no mismatch', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await hydrate(directiveComponent(LCP_HTML))

    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  test('getSSRProps puts the html into the server-rendered markup', async () => {
    expect(await serverRender(LCP_HTML)).toContain('<p id="lcp">')
    expect(ssrPropsFor(LCP_HTML)).toEqual({ innerHTML: LCP_HTML })
  })

  test('getSSRProps renders an empty container rather than the string undefined', () => {
    expect(ssrPropsFor(undefined)).toEqual({ innerHTML: '' })
  })

  test('a client-side mount into an empty container renders the html', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    createApp(directiveComponent(LCP_HTML)).mount(container)

    expect((container.firstElementChild as HTMLElement).innerHTML).toBe(LCP_HTML)
  })

  test('markup the browser serialises differently is re-assigned on mount', async () => {
    const stored = '<p id="lcp">one<br/>two</p>'
    const result = await hydrate(directiveComponent(stored), stored)

    expect(result.survived).toBe(false)
    expect(result.renderedHtml).toBe('<p id="lcp">one<br>two</p>')
  })

  test('html written by the editor survives hydration, because the editor stores what the browser serialises', async () => {
    const stored = '<p id="lcp">Fish &amp; Chips for 2&nbsp;people<br>on Daniel’s page</p>'
    const reserialised = document.createElement('div')
    reserialised.innerHTML = stored
    expect(reserialised.innerHTML).toBe(stored)

    const result = await hydrate(directiveComponent(stored), stored)

    expect(result.survived).toBe(true)
    expect(result.renderedHtml).toBe(stored)
  })

  test('changing the html replaces the content', async () => {
    const html = ref('<p id="lcp">before</p>')
    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = await serverRender(html.value)

    createSSRApp(defineComponent({
      render: () => withDirectives(createElementVNode('div', { class: 'prose' }, null, 512), [[vCwaHtml, html.value]]),
    })).mount(container)

    html.value = '<p id="lcp">after</p>'
    await nextTick()

    expect((container.firstElementChild as HTMLElement).innerHTML).toBe('<p id="lcp">after</p>')
  })

  test('a re-render that does not change the html leaves the content untouched', async () => {
    const unrelated = ref(0)
    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = await serverRender(LCP_HTML)

    createSSRApp(defineComponent({
      render: () => withDirectives(
        createElementVNode('div', { 'class': 'prose', 'data-n': unrelated.value }, null, 512),
        [[vCwaHtml, LCP_HTML]],
      ),
    })).mount(container)

    const paragraph = container.querySelector('#lcp')

    unrelated.value = 1
    await nextTick()

    expect(container.querySelector('#lcp')).toBe(paragraph)
  })
})

describe('vCwaHtml with useHtmlContent', () => {
  function mountWithComposable(html: Ref<string>) {
    const inspected: string[] = []

    const component = defineComponent({
      setup() {
        const htmlContainer = ref<null | HTMLElement>(null)
        useHtmlContent(htmlContainer, html)
        return () => withDirectives(
          createElementVNode('div', { ref: htmlContainer }, null, 512),
          [[vCwaHtml, html.value]],
        )
      },
    })

    const container = document.createElement('div')
    document.body.appendChild(container)
    createApp(component).mount(container)

    const element = container.firstElementChild as HTMLElement
    vi.spyOn(element, 'getElementsByTagName').mockImplementation(() => {
      inspected.push(element.innerHTML)
      return [] as unknown as HTMLCollectionOf<HTMLElement>
    })

    return { inspected }
  }

  test('anchor conversion inspects the new html, not the html it replaced', async () => {
    const html = ref('<p>before</p>')
    const { inspected } = mountWithComposable(html)

    html.value = '<p>after <a href="/two">two</a></p>'
    await nextTick()

    expect(inspected).toEqual(['<p>after <a href="/two">two</a></p>'])
  })
})

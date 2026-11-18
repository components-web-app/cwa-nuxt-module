// @vitest-environment nuxt
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import PageResourceAdminModal from './PageResourceAdminModal.vue'
import * as cwaComposable from '#cwa/composables/cwa'

const routeState = vi.hoisted(() => ({ route: undefined as unknown as { name: string, params: Record<string, string>, query: Record<string, string>, hash: string } }))
const push = vi.hoisted(() => vi.fn())
const confirm = vi.hoisted(() => vi.fn())

vi.mock('vue-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue-router')>()
  const { reactive } = await import('vue')
  routeState.route = reactive({ name: '_cwa-pages-iri', params: { iri: 'add' }, query: {}, hash: '' })
  return { ...mod, useRoute: () => routeState.route, useRouter: () => ({ push }) }
})
vi.mock('#cwa/composables/cwa-confirm', () => ({ useCwaConfirm: () => confirm }))
vi.mock('#cwa/resources/realtime-view', () => ({
  realtimeView: () => ({ load: async () => ({ peers: () => [] }) }),
}))

enableAutoUnmount(afterEach)
afterEach(() => {
  confirm.mockReset()
})

function setup(resourceType: string, members: Record<string, Record<string, any>[]>) {
  const createResource = vi.fn(async () => undefined)
  const fetch = vi.fn(({ path }: { path: string }) => ({
    response: Promise.resolve({ _data: { member: members[path.split('?')[0]!] ?? [] } }),
  }))
  const getApiDocumentation = vi.fn(async () => ({
    entrypoint: { blogArticleData: '/page_data/blog_article_datas' },
    pageDataMetadata: { member: [] },
  }))
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: {
      displayPageIri: ref(undefined),
      getResource: () => computed(() => undefined),
    },
    resourcesManager: { createResource, errors: reactive([]), removeError: vi.fn(), addError: vi.fn() },
    fetch,
    fetchResource: vi.fn(),
    getApiDocumentation,
    pagesConfig: {},
    pageDataConfig: {},
    admin: { toggleEdit: vi.fn() },
  }) as unknown as ReturnType<typeof cwaComposable.useCwa>)

  const wrapper = mount(PageResourceAdminModal, {
    props: { resourceType },
    attachTo: document.body,
  })
  return { wrapper, createResource, fetch, getApiDocumentation }
}

function byLabel(text: string) {
  const label = [...document.querySelectorAll('label')].find(found => found.textContent?.trim().startsWith(text))!
  return document.getElementById(label.htmlFor) as HTMLInputElement
}

function tab(name: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(found => found.textContent?.trim() === name)!
}

function footerButtons() {
  return [...document.querySelectorAll<HTMLButtonElement>('footer button')]
}

describe('PageResourceAdminModal in the real dialog, creating (#461)', () => {
  test.each([
    ['page', 'Page', 'Reference', 'reference', '+ Page', 'Create page', { '/_/layouts': [{ '@id': '/_/layouts/a', 'reference': 'A' }] }],
    ['blog article', 'BlogArticleData', 'Title', 'title', '+ Blog article', 'Create blog article', { '/_/pages': [{ '@id': '/_/pages/template', 'reference': 'Template' }] }],
  ])('what is typed into a new %s is the same field after the Routes tab and back, and the one Create sends it', async (noun, resourceType, label, property, text, name, members) => {
    const { createResource, fetch, getApiDocumentation } = setup(resourceType, members)
    await flushPromises()
    expect(fetch).toHaveBeenCalled()
    expect(getApiDocumentation).toHaveBeenCalled()

    const input = byLabel(label)
    input.value = 'Typed'
    input.dispatchEvent(new Event('input'))
    await flushPromises()

    tab('Routes').click()
    await flushPromises()
    expect(tab('Routes').getAttribute('aria-selected')).toBe('true')
    expect(document.querySelector('[data-tab="routes"]')!.textContent).toContain(`Routes open once the ${noun} is created.`)

    tab('Details').click()
    await flushPromises()
    expect(byLabel(label)).toBe(input)
    expect(input.value).toBe('Typed')

    const creates = footerButtons().filter(button => button.getAttribute('aria-label') === name)
    expect(creates).toHaveLength(1)
    expect(creates[0]!.textContent?.trim()).toBe(text)
    expect(footerButtons().filter(button => /^Save/.test(button.textContent?.trim() ?? ''))).toHaveLength(0)

    creates[0]!.click()
    await flushPromises()
    expect(createResource).toHaveBeenCalledOnce()
    expect(createResource).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ [property]: 'Typed' }) }))
  })

  test('a create refused for an empty Reference shows the error on the field and the "wasn\'t saved" alert linking to it', async () => {
    const { createResource } = setup('Page', { '/_/layouts': [{ '@id': '/_/layouts/a', 'reference': 'A' }] })
    createResource.mockImplementationOnce(async (event: any) => {
      const error = Object.assign(new Error('refused'), { statusCode: 422, data: { violations: [{ propertyPath: 'reference', message: 'This value should not be blank.' }] } })
      event.onRequest?.(event.endpoint, Promise.resolve({ error }))
      return undefined
    })
    await flushPromises()

    footerButtons().find(button => button.getAttribute('aria-label') === 'Create page')!.click()
    await flushPromises()

    const alert = document.querySelector('[data-testid="dialog-alert"]')!
    expect(alert.textContent).toContain('This page wasn\'t saved. 1 field needs a change.')
    expect([...alert.querySelectorAll('li')].map(item => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Reference · Details tab'])
    expect(byLabel('Reference').getAttribute('aria-invalid')).toBe('true')
    expect(document.body.textContent).toContain('This value should not be blank.')
  })

  test('a new page left as it opened, with its layout pre-selected, closes without asking; once typed into, closing asks first', async () => {
    const { wrapper } = setup('Page', { '/_/layouts': [{ '@id': '/_/layouts/a', 'reference': 'A' }] })
    await flushPromises()

    document.querySelector<HTMLButtonElement>('[data-testid="dialog-close"]')!.click()
    await flushPromises()
    expect(confirm).not.toHaveBeenCalled()
    expect(wrapper.emitted('close')).toHaveLength(1)

    const input = byLabel('Reference')
    input.value = 'Typed'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    confirm.mockResolvedValueOnce(false)
    document.querySelector<HTMLButtonElement>('[data-testid="dialog-close"]')!.click()
    await flushPromises()

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Discard 1 unsaved change?', description: 'Your changes to Reference will be lost.' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})

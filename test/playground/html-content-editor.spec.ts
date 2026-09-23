// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { computed, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import HtmlContent from '../../playground/app/cwa/components/HtmlContent/HtmlContent.vue'
import { vCwaHtml } from '#cwa/directives/cwa-html'

const isEditing = vi.hoisted(() => ({ value: false }))

mockNuxtImport('useCwaComponent', () => () => ({
  resource: computed(() => ({ data: { html: '<p>Body text</p>' } })),
  exposeMeta: {},
  $cwa: { admin: { isEditing: isEditing.value } },
}))

mockNuxtImport('useHtmlContent', () => () => ({ vCwaHtml }))

vi.mock('~/composables/useCustomHtmlComponent', () => ({
  useCustomHtmlComponent: () => ({
    resourceModel: { model: ref('<p>Body text</p>') },
    disableEditor: computed(() => true),
  }),
}))

describe('playground HtmlContent', () => {
  test('renders the resource html and nothing else while the admin is not editing', () => {
    const wrapper = mount(HtmlContent, { props: { iri: '/component/html_contents/abc' } })

    expect(wrapper.get('article').element.children).toHaveLength(1)
    expect(wrapper.get('div.prose').html()).toContain('<p>Body text</p>')
  })
})

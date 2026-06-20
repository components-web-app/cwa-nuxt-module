// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RoutesTabForwardTo from './RoutesTabForwardTo.vue'
import SearchResource from '#cwa/templates/components/ui/form/SearchResource.vue'

function mountForwardTo(overrides: Record<string, any> = {}) {
  return mount(RoutesTabForwardTo, {
    props: {
      disableButtons: false,
      currentRouteIri: '/_api/_/routes//topic-1',
      ...overrides,
    },
    shallow: true,
  })
}

describe('RoutesTabForwardTo', () => {
  test('Save is disabled when no IRI is selected', () => {
    const wrapper = mountForwardTo()
    expect(wrapper.find('[data-save-forward]').attributes('disabled')).toBeDefined()
  })

  test('Save is disabled and shows self-redirect warning when selected IRI matches current route', async () => {
    const wrapper = mountForwardTo()
    await wrapper.findComponent(SearchResource).vm.$emit('update:modelValue', '/_api/_/routes//topic-1')
    expect(wrapper.find('[data-save-forward]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('cannot redirect to itself')
  })

  test('Save is enabled when a different route IRI is selected', async () => {
    const wrapper = mountForwardTo()
    await wrapper.findComponent(SearchResource).vm.$emit('update:modelValue', '/_api/_/routes//topic-1/chapter-one')
    // shallow stubs render :disabled="false" as disabled="false" (not undefined), so check it's not "true"
    expect(wrapper.find('[data-save-forward]').attributes('disabled')).not.toBe('true')
  })

  test('Save button emits create with the selected IRI', async () => {
    const wrapper = mountForwardTo()
    await wrapper.findComponent(SearchResource).vm.$emit('update:modelValue', '/_api/_/routes//topic-1/chapter-one')
    await wrapper.find('[data-save-forward]').trigger('click')
    expect(wrapper.emitted('create')?.[0]).toEqual(['/_api/_/routes//topic-1/chapter-one'])
  })

  test('pre-fills SearchResource modelValue with initialIri when provided', () => {
    const wrapper = mountForwardTo({ initialIri: '/_api/_/routes//topic-1/chapter-one' })
    expect(wrapper.findComponent(SearchResource).props('modelValue')).toBe('/_api/_/routes//topic-1/chapter-one')
  })

  test('SearchResource is configured with /_/routes endpoint and path property', () => {
    const wrapper = mountForwardTo()
    const searchProps = wrapper.findComponent(SearchResource).props()
    expect(searchProps.endpoint).toBe('/_/routes')
    expect(searchProps.property).toBe('path')
  })
})

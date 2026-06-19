// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RoutesTabManage from './RoutesTabManage.vue'
import ModalInput from '#cwa/templates/components/core/admin/form/ModalInput.vue'
import ModalSelect from '#cwa/templates/components/core/admin/form/ModalSelect.vue'

function mountManage(options: {
  modelValue?: string
  parentRoutePrefix?: string | null
  currentPath?: string
  title?: string
} = {}) {
  return mount(RoutesTabManage, {
    props: {
      disableButtons: false,
      pageResource: { title: options.title ?? 'My Programme', route: '/_/routes//conference/programme' },
      currentPath: options.currentPath ?? '/conference/programme',
      parentRoutePrefix: options.parentRoutePrefix !== undefined ? options.parentRoutePrefix : '/conference',
      modelValue: options.modelValue ?? '/conference/programme',
    } as any,
    shallow: true,
  })
}

function getPrefixInput(wrapper: ReturnType<typeof mountManage>) {
  return wrapper.findComponent(ModalSelect)
}

function getSuffixInput(wrapper: ReturnType<typeof mountManage>) {
  return wrapper.findComponent(ModalInput)
}

describe('RoutesTabManage', () => {
  describe('prefix/suffix initialisation', () => {
    test('initialises prefix from parentRoutePrefix and suffix from remainder when path starts with prefix', () => {
      const wrapper = mountManage({ modelValue: '/conference/programme', parentRoutePrefix: '/conference' })
      expect(getPrefixInput(wrapper).props('modelValue')).toBe('/conference')
      expect(getSuffixInput(wrapper).props('modelValue')).toBe('/programme')
    })

    test('resets prefix to "/" and uses full path as suffix when path does not start with parentRoutePrefix', () => {
      const wrapper = mountManage({ modelValue: '/standalone-page', parentRoutePrefix: '/conference' })
      expect(getPrefixInput(wrapper).props('modelValue')).toBe('/')
      expect(getSuffixInput(wrapper).props('modelValue')).toBe('/standalone-page')
    })

    test('uses "/" as prefix and full path as suffix when no parentRoutePrefix', () => {
      const wrapper = mountManage({ modelValue: '/my-page', parentRoutePrefix: null })
      expect(getPrefixInput(wrapper).props('modelValue')).toBe('/')
      expect(getSuffixInput(wrapper).props('modelValue')).toBe('/my-page')
    })
  })

  describe('path assembly', () => {
    test('emits prefix + suffix when suffix changes', async () => {
      const wrapper = mountManage({ modelValue: '/conference/programme', parentRoutePrefix: '/conference' })
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', '/new-page')
      expect(wrapper.emitted('update:modelValue')).toEqual([['/conference/new-page']])
    })

    test('emits newPrefix + suffix when prefix changes', async () => {
      const wrapper = mountManage({ modelValue: '/conference/programme', parentRoutePrefix: '/conference' })
      await getPrefixInput(wrapper).vm.$emit('update:modelValue', '/events')
      expect(wrapper.emitted('update:modelValue')).toEqual([['/events/programme']])
    })

    test('emits just the suffix when prefix is "/"', async () => {
      const wrapper = mountManage({ modelValue: '/my-page', parentRoutePrefix: null })
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', '/new-page')
      expect(wrapper.emitted('update:modelValue')).toEqual([['/new-page']])
    })

    test('normalises missing leading slash on suffix when prefix is not "/"', async () => {
      const wrapper = mountManage({ modelValue: '/conference/programme', parentRoutePrefix: '/conference' })
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', 'no-slash')
      expect(wrapper.emitted('update:modelValue')).toEqual([['/conference/no-slash']])
    })

    test('normalises missing leading slash on suffix when prefix is "/"', async () => {
      const wrapper = mountManage({ modelValue: '/my-page', parentRoutePrefix: null })
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', 'no-slash')
      expect(wrapper.emitted('update:modelValue')).toEqual([['/no-slash']])
    })

    test('trims leading/trailing spaces from suffix before assembling path (#209)', async () => {
      const wrapper = mountManage({ modelValue: '/conference/programme', parentRoutePrefix: '/conference' })
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', ' /new-page ')
      expect(wrapper.emitted('update:modelValue')).toEqual([['/conference/new-page']])
    })

    test('trims leading space from suffix when prefix is "/" (#209)', async () => {
      const wrapper = mountManage({ modelValue: '/my-page', parentRoutePrefix: null })
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', ' /journal')
      expect(wrapper.emitted('update:modelValue')).toEqual([['/journal']])
    })

    test('SEO recommendation always uses parentRoutePrefix regardless of selected prefix', async () => {
      const wrapper = mountManage({ title: 'My Programme', parentRoutePrefix: '/conference' })
      await getPrefixInput(wrapper).vm.$emit('update:modelValue', '/')
      expect(wrapper.find('[data-seo-recommendation]').text()).toContain('/conference/my-programme')
    })
  })

  describe('SEO recommendation', () => {
    test('shows the full recommended path (prefix + slugified suffix) as SEO recommendation', () => {
      const wrapper = mountManage({ title: 'My Great Programme', parentRoutePrefix: '/conference' })
      expect(wrapper.find('[data-seo-recommendation]').text()).toContain('/conference/my-great-programme')
    })

    test('shows just the slugified suffix as SEO recommendation when no parentRoutePrefix', () => {
      const wrapper = mountManage({ title: 'My Programme', parentRoutePrefix: null })
      expect(wrapper.find('[data-seo-recommendation]').text()).toContain('/my-programme')
    })

    test('Apply button is disabled when currentPath already matches the full recommended path', () => {
      const wrapper = mountManage({
        title: 'My Programme',
        parentRoutePrefix: '/conference',
        currentPath: '/conference/my-programme',
      })
      expect(wrapper.findComponent('[data-apply-seo]').props('disabled')).toBe(true)
    })

    test('strips full stops from SEO recommended slug (#210)', () => {
      const wrapper = mountManage({ title: 'Dr. Smith', parentRoutePrefix: null })
      expect(wrapper.find('[data-seo-recommendation]').text()).toBe('/dr-smith')
    })

    test('strips punctuation other than hyphens from SEO recommended slug (strict mode)', () => {
      const wrapper = mountManage({ title: 'Hello! World?', parentRoutePrefix: null })
      expect(wrapper.find('[data-seo-recommendation]').text()).toBe('/hello-world')
    })

    test('Apply button is enabled when currentPath differs from the full recommended path', () => {
      const wrapper = mountManage({
        title: 'My Programme',
        parentRoutePrefix: '/conference',
        currentPath: '/conference/old-name',
      })
      expect(wrapper.findComponent('[data-apply-seo]').props('disabled')).toBe(false)
    })
  })
})

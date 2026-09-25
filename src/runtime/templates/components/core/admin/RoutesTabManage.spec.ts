// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RoutesTabManage from './RoutesTabManage.vue'
import ModalInput from '#cwa/templates/components/core/admin/form/ModalInput.vue'
import ModalSelect from '#cwa/templates/components/core/admin/form/ModalSelect.vue'
import { formatDateTime } from '#cwa/resources/date-time-input'

function mountManage(options: {
  modelValue?: string
  parentRoutePrefix?: string | null
  currentPath?: string
  title?: string
  liveAt?: string | null
  effectiveLiveAt?: string | null
} = {}) {
  return mount(RoutesTabManage, {
    props: {
      disableButtons: false,
      pageResource: { title: options.title ?? 'My Programme', route: '/_/routes//conference/programme' },
      currentPath: options.currentPath ?? '/conference/programme',
      parentRoutePrefix: options.parentRoutePrefix !== undefined ? options.parentRoutePrefix : '/conference',
      modelValue: options.modelValue ?? '/conference/programme',
      liveAt: options.liveAt,
      routePublication: { liveAt: options.liveAt, effectiveLiveAt: options.effectiveLiveAt },
    } as any,
    shallow: true,
  })
}

function getStateSelect(wrapper: ReturnType<typeof mountManage>) {
  return wrapper.findComponent('[data-publication-state]')
}

function getLiveAtInput(wrapper: ReturnType<typeof mountManage>) {
  return wrapper.findComponent('[data-live-at]')
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

    test('defaults prefix to parentRoutePrefix when path is empty (creating a new route) (#230)', () => {
      const wrapper = mountManage({ modelValue: '', parentRoutePrefix: '/conference' })
      expect(getPrefixInput(wrapper).props('modelValue')).toBe('/conference')
      expect(getSuffixInput(wrapper).props('modelValue')).toBe('')
    })

    test('updates prefix to parentRoutePrefix when it loads asynchronously and path is empty (#230)', async () => {
      const wrapper = mountManage({ modelValue: '', parentRoutePrefix: null })
      expect(getPrefixInput(wrapper).props('modelValue')).toBe('/')
      await wrapper.setProps({ parentRoutePrefix: '/conference' })
      expect(getPrefixInput(wrapper).props('modelValue')).toBe('/conference')
      expect(getSuffixInput(wrapper).props('modelValue')).toBe('')
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

  describe('publication state', () => {
    test('offers live, scheduled and draft', () => {
      const labels = (getStateSelect(mountManage()).props('options') as { label: string }[]).map(o => o.label)
      expect(labels).toEqual(['Live', 'Scheduled', 'Not live'])
    })

    test('shows a route with a past go-live date as live', () => {
      const wrapper = mountManage({ liveAt: '2020-01-01T00:00:00+00:00' })
      expect(getStateSelect(wrapper).props('modelValue')).toBe('live')
      expect(getLiveAtInput(wrapper).exists()).toBe(false)
    })

    test('shows a route with a future go-live date as scheduled, with the date it goes live', () => {
      const wrapper = mountManage({ liveAt: '2999-01-01T09:00:00Z' })
      expect(getStateSelect(wrapper).props('modelValue')).toBe('scheduled')
      expect(getLiveAtInput(wrapper).props('modelValue')).toBe('2999-01-01T09:00:00Z')
    })

    test('shows a route the API gave no go-live date as not live', () => {
      const wrapper = mountManage({ liveAt: undefined })
      expect(getStateSelect(wrapper).props('modelValue')).toBe('draft')
      expect(getLiveAtInput(wrapper).exists()).toBe(false)
    })

    test('taking a route offline keeps its URL and commits no go-live date', async () => {
      const wrapper = mountManage({ liveAt: '2020-01-01T00:00:00+00:00' })
      await getStateSelect(wrapper).vm.$emit('update:modelValue', 'draft')
      expect(wrapper.emitted('update:liveAt')).toEqual([[null]])
    })

    test('choosing live on a route scheduled for a future date commits an instant that has already passed', async () => {
      const wrapper = mountManage({ liveAt: '2999-01-01T00:00:00+00:00' })
      const before = Date.now()
      await getStateSelect(wrapper).vm.$emit('update:modelValue', 'live')
      const committed = wrapper.emitted('update:liveAt')?.[0]?.[0] as string
      expect(new Date(committed).getTime()).toBeGreaterThanOrEqual(before)
      expect(new Date(committed).getTime()).toBeLessThanOrEqual(Date.now())
    })

    test('choosing live on a route with no go-live date commits an instant that has already passed', async () => {
      const wrapper = mountManage({ liveAt: null })
      const before = Date.now()
      await getStateSelect(wrapper).vm.$emit('update:modelValue', 'live')
      const committed = wrapper.emitted('update:liveAt')?.[0]?.[0] as string
      expect(new Date(committed).getTime()).toBeGreaterThanOrEqual(before)
      expect(new Date(committed).getTime()).toBeLessThanOrEqual(Date.now())
    })

    test('choosing live on a route that is already live keeps the date it went live', async () => {
      const wrapper = mountManage({ liveAt: '2020-01-01T00:00:00+00:00' })
      await getStateSelect(wrapper).vm.$emit('update:modelValue', 'live')
      expect(wrapper.emitted('update:liveAt')).toBeUndefined()
    })

    test('returning a live route to live after scheduling it restores the date it went live', async () => {
      const wrapper = mountManage({ liveAt: '2020-01-01T00:00:00+00:00' })
      await getStateSelect(wrapper).vm.$emit('update:modelValue', 'scheduled')
      await getStateSelect(wrapper).vm.$emit('update:modelValue', 'live')
      expect(wrapper.emitted('update:liveAt')).toEqual([[null], ['2020-01-01T00:00:00+00:00']])
    })

    test('shows a live route the date it has been live from', () => {
      const wrapper = mountManage({ liveAt: '2020-01-01T00:00:00+00:00' })
      expect(wrapper.find('[data-live-since]').text()).toContain(formatDateTime('2020-01-01T00:00:00+00:00'))
    })

    test('shows no live-since date for a route that is not live', () => {
      const wrapper = mountManage({ liveAt: null })
      expect(wrapper.find('[data-live-since]').exists()).toBe(false)
    })

    test('shows no live-since date for a route that is scheduled', () => {
      const wrapper = mountManage({ liveAt: '2999-01-01T00:00:00+00:00' })
      expect(wrapper.find('[data-live-since]').exists()).toBe(false)
    })

    test('choosing scheduled reveals the date picker, offering nothing earlier than now, and holds the route back until a date is given', async () => {
      const wrapper = mountManage({ liveAt: '2020-01-01T00:00:00+00:00' })
      const before = Date.now()
      await getStateSelect(wrapper).vm.$emit('update:modelValue', 'scheduled')
      expect(getLiveAtInput(wrapper).props('modelValue')).toBeNull()
      expect(new Date(getLiveAtInput(wrapper).props('min')).getTime()).toBeGreaterThanOrEqual(before - 1000)
      expect(wrapper.emitted('update:liveAt')).toEqual([[null]])
    })

    test('commits the UTC instant the date picker gives', async () => {
      const wrapper = mountManage({ liveAt: '2999-01-01T00:00:00+00:00' })
      await getLiveAtInput(wrapper).vm.$emit('update:modelValue', '2999-09-25T08:00:00.000Z')
      expect(wrapper.emitted('update:liveAt')).toEqual([['2999-09-25T08:00:00.000Z']])
    })
  })

  describe('a parent route holding the page back', () => {
    test('tells the editor when the page actually becomes reachable, while still editing the route own date', () => {
      const effectiveLiveAt = '2999-01-01T09:00:00Z'
      const wrapper = mountManage({ liveAt: '2020-01-01T00:00:00+00:00', effectiveLiveAt })
      expect(getStateSelect(wrapper).props('modelValue')).toBe('live')
      expect(wrapper.find('[data-effective-live-at]').text()).toContain(formatDateTime(effectiveLiveAt))
    })

    test('says nothing about parents when the effective date matches the route own date', () => {
      const wrapper = mountManage({ liveAt: '2020-01-01T00:00:00+00:00', effectiveLiveAt: '2020-01-01T00:00:00+00:00' })
      expect(wrapper.find('[data-effective-live-at]').exists()).toBe(false)
    })

    test('warns the editor when a draft ancestor makes the page unreachable at any date', () => {
      const wrapper = mountManage({ liveAt: '2020-01-01T00:00:00+00:00' })
      const note = wrapper.find('[data-effective-live-at]')
      expect(note.exists()).toBe(true)
      expect(note.text()).toContain('no go-live date')
    })

    test('stops claiming a parent gate once the editor schedules beyond it', async () => {
      const wrapper = mountManage({ liveAt: '2020-01-01T00:00:00+00:00', effectiveLiveAt: '2999-01-01T09:00:00Z' })
      await getStateSelect(wrapper).vm.$emit('update:modelValue', 'scheduled')
      await getLiveAtInput(wrapper).vm.$emit('update:modelValue', '3999-01-01T09:00:00.000Z')
      expect(wrapper.find('[data-effective-live-at]').exists()).toBe(false)
    })
  })
})

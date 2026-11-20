// @vitest-environment nuxt
import { describe, test, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RoutesTabManage from './RoutesTabManage.vue'
import RouteRecommendation from './RouteRecommendation.vue'
import CwaUiInput from '#cwa/templates/components/ui/Input.vue'
import { formatDateTime } from '#cwa/resources/date-time-input'

function mountManage(options: {
  modelValue?: string
  lockedPrefix?: string | null
  currentPath?: string
  liveAt?: string | null
  effectiveLiveAt?: string | null
  recommendedPath?: string
  recommendedFrom?: string
  childPaths?: string[]
  redirectCount?: number
  optional?: boolean
  noun?: string
} = {}) {
  return mount(RoutesTabManage, {
    props: {
      recommendedPath: options.recommendedPath,
      recommendedFrom: options.recommendedFrom,
      childPaths: options.childPaths,
      redirectCount: options.redirectCount,
      optional: options.optional,
      noun: options.noun,
      currentPath: options.currentPath ?? '/conference/programme',
      lockedPrefix: options.lockedPrefix !== undefined ? options.lockedPrefix ?? undefined : '/conference',
      modelValue: options.modelValue ?? '/conference/programme',
      liveAt: options.liveAt,
      routePublication: { liveAt: options.liveAt, effectiveLiveAt: options.effectiveLiveAt },
    } as any,
    shallow: true,
    global: { stubs: { CwaReveal: false } },
  })
}

function getStateSelect(wrapper: ReturnType<typeof mountManage>) {
  return wrapper.findComponent('[data-publication-state]')
}

function getLiveAtInput(wrapper: ReturnType<typeof mountManage>) {
  return wrapper.findComponent('[data-live-at]')
}

function getSuffixInput(wrapper: ReturnType<typeof mountManage>) {
  return wrapper.findComponent(CwaUiInput)
}

describe('RoutesTabManage', () => {
  describe('the start a route must have (api-components-bundle#601)', () => {
    function locked(wrapper: ReturnType<typeof mountManage>) {
      return wrapper.find('[data-testid="route-locked-prefix"]')
    }

    test('stands locked in front of the path, and only the rest after it is typed', async () => {
      const wrapper = mountManage({ currentPath: '', modelValue: '', lockedPrefix: '/conference/updates' })
      expect(locked(wrapper).text()).toBe('/conference/updates/')
      expect(getSuffixInput(wrapper).props('label')).toBe('Rest of the path after /conference/updates/')
      expect(getSuffixInput(wrapper).props('modelValue')).toBe('')

      await getSuffixInput(wrapper).vm.$emit('update:modelValue', 'gates-open')
      expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['/conference/updates/gates-open'])
    })

    test('an existing route under it shows only the rest, and is not changed until something is typed', () => {
      const wrapper = mountManage({ modelValue: '/conference/programme', lockedPrefix: '/conference' })
      expect(getSuffixInput(wrapper).props('modelValue')).toBe('programme')
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })

    test('an older route outside it keeps its whole path after the lock, so editing it makes it valid', async () => {
      const wrapper = mountManage({ modelValue: '/standalone-page', lockedPrefix: '/conference' })
      expect(getSuffixInput(wrapper).props('modelValue')).toBe('standalone-page')
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()

      await getSuffixInput(wrapper).vm.$emit('update:modelValue', 'standalone-pages')
      expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['/conference/standalone-pages'])
    })

    test.each([
      ['a leading slash', '/new-page', '/conference/new-page'],
      ['no slash', 'no-slash', '/conference/no-slash'],
      ['spaces either side (#209)', ' /new-page ', '/conference/new-page'],
    ])('the rest typed with %s goes after it', async (_, typed, path) => {
      const wrapper = mountManage({ modelValue: '/conference/programme', lockedPrefix: '/conference' })
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', typed)
      expect(wrapper.emitted('update:modelValue')).toEqual([[path]])
    })

    test('the recommended path fills only the rest after it', async () => {
      const wrapper = mountManage({ currentPath: '', modelValue: '', lockedPrefix: '/announcements', recommendedPath: '/announcements/summer-fair' })
      await wrapper.findComponent(RouteRecommendation).vm.$emit('use')
      expect(getSuffixInput(wrapper).props('modelValue')).toBe('summer-fair')
      expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['/announcements/summer-fair'])
    })

    test('one that arrives once the field is open goes in front of what was typed', async () => {
      const wrapper = mountManage({ currentPath: '', modelValue: '', lockedPrefix: null })
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', 'summer-fair')
      await wrapper.setProps({ lockedPrefix: '/announcements' })
      expect(locked(wrapper).text()).toBe('/announcements/')
      expect(getSuffixInput(wrapper).props('modelValue')).toBe('summer-fair')
      expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['/announcements/summer-fair'])
    })

    test('one that arrives for an existing route only splits the field, never changing the path', async () => {
      const wrapper = mountManage({ modelValue: '/conference/programme', lockedPrefix: null })
      expect(getSuffixInput(wrapper).props('modelValue')).toBe('/conference/programme')
      await wrapper.setProps({ lockedPrefix: '/conference' })
      expect(getSuffixInput(wrapper).props('modelValue')).toBe('programme')
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })

    test('without one the whole path is typed, with its leading slash', async () => {
      const wrapper = mountManage({ modelValue: '/my-page', lockedPrefix: null })
      expect(locked(wrapper).exists()).toBe(false)
      expect(getSuffixInput(wrapper).props('label')).toBe('Path')
      expect(getSuffixInput(wrapper).props('modelValue')).toBe('/my-page')
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', ' journal')
      expect(wrapper.emitted('update:modelValue')).toEqual([['/journal']])
    })
  })

  describe('the recommendation', () => {
    test('offers the recommended path when the path differs', () => {
      const wrapper = mountManage({ modelValue: '/conference/programme', recommendedPath: '/conference/my-programme' })
      expect(wrapper.findComponent(RouteRecommendation).props('path')).toBe('/conference/my-programme')
    })

    test('names the page title the recommendation is based on', () => {
      const wrapper = mountManage({ modelValue: '/conference/programme', recommendedPath: '/conference/my-programme', recommendedFrom: 'My programme' })
      expect(wrapper.findComponent(RouteRecommendation).props('from')).toBe('My programme')
    })

    test('never recommends a path for the route at /, the homepage', () => {
      const wrapper = mountManage({ currentPath: '/', modelValue: '/', lockedPrefix: null, recommendedPath: '/welcome-to-cwa' })
      expect(wrapper.findComponent(RouteRecommendation).exists()).toBe(false)
    })

    test('says the path is the recommended one instead of offering it', () => {
      const wrapper = mountManage({ modelValue: '/conference/programme', recommendedPath: '/conference/programme' })
      expect(wrapper.findComponent(RouteRecommendation).exists()).toBe(false)
      expect(getSuffixInput(wrapper).props('description')).toBe('This is the recommended path.')
    })
  })

  describe('what saving will do', () => {
    test('a changed path says the old one keeps working, and offers to change the child routes under it, checked', async () => {
      const wrapper = mountManage({ modelValue: '/conference/programme', childPaths: ['/conference/programme/day-1', '/conference/programme/day-2', '/conference/elsewhere'] })
      expect(wrapper.find('[data-testid="route-old-path"]').exists()).toBe(false)

      await wrapper.setProps({ modelValue: '/conference/schedule' })

      expect(wrapper.find('[data-testid="route-old-path"]').text()).toBe('The old path, /conference/programme, keeps working: it will redirect here.')
      const cascade = wrapper.find<HTMLInputElement>('[data-testid="route-cascade"]')
      expect(cascade.element.checked).toBe(true)
      expect(cascade.element.closest('label')!.textContent).toContain('Also change the 2 child routes that start with /conference/programme/')
      await cascade.setValue(false)
      expect(wrapper.emitted('update:cascade')).toEqual([[false]])
    })

    test('offers no cascade when no child route starts with the old path', () => {
      const wrapper = mountManage({ modelValue: '/conference/schedule', childPaths: ['/conference/elsewhere'] })
      expect(wrapper.find('[data-testid="route-old-path"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="route-cascade"]').exists()).toBe(false)
    })

    test.each([
      ['/ (root)', null, ''],
      ['a parent route', '/conference', '/conference'],
    ])('a new route with an empty path under %s asks for one, and has no path yet', async (_, lockedPrefix, modelValue) => {
      const wrapper = mountManage({ currentPath: '', modelValue, lockedPrefix })
      expect(wrapper.find('[data-testid="route-go-live-line"]').text()).toBe('Enter a path.')
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', 'talks')
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', '  ')
      expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([''])
      expect(wrapper.find('[data-testid="route-go-live-line"]').text()).toBe('Enter a path.')
    })

    test('an optional new route with no path says the page is created without one, and still says where visitors reach it once typed', async () => {
      const wrapper = mountManage({ currentPath: '', modelValue: '', lockedPrefix: null, optional: true, noun: 'page' })
      expect(wrapper.find('[data-testid="route-go-live-line"]').text()).toBe('Leave the path empty to create the page without a route.')
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', 'about')
      expect(wrapper.find('[data-testid="route-go-live-line"]').text()).toBe('Visitors will reach this page at /about.')
    })

    test('typing / is the homepage path', async () => {
      const wrapper = mountManage({ currentPath: '', modelValue: '', lockedPrefix: null })
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', '/')
      expect(wrapper.emitted('update:modelValue')).toEqual([['/']])
      expect(wrapper.find('[data-testid="route-go-live-line"]').text()).toBe('Visitors will reach this page at /.')
    })

    test.each([
      ['/ (root)', null, '', 'spring  sale ', '/spring-sale'],
      ['a parent route', '/conference', '/conference', 'spring sale', '/conference/spring-sale'],
    ])('spaces typed under %s become one hyphen each run in the path and its hint as they are typed, and in the field once it is left, so the caret never jumps', async (_, lockedPrefix, modelValue, typed, path) => {
      const wrapper = mountManage({ currentPath: '', modelValue, lockedPrefix })
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', typed)
      expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([path])
      expect(wrapper.find('[data-testid="route-go-live-line"]').text()).toBe(`Visitors will reach this page at ${path}.`)
      expect(getSuffixInput(wrapper).props('modelValue')).toBe(typed)
      expect(getSuffixInput(wrapper).props('invalid')).toBeUndefined()

      await getSuffixInput(wrapper).vm.$emit('focusout')
      expect(getSuffixInput(wrapper).props('modelValue')).toBe('spring-sale')
      expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([path])
    })

    test.each(['spring?sale', 'spring#sale'])('“%s” is refused as it is typed, and the API\'s own error still wins', async (typed) => {
      const wrapper = mountManage({ currentPath: '', modelValue: '', lockedPrefix: null })
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', typed)
      expect(getSuffixInput(wrapper).props('invalid')).toBe('A path can\'t contain ? or #. They start a query or a page anchor.')
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', 'spring-sale')
      expect(getSuffixInput(wrapper).props('invalid')).toBeUndefined()
      await wrapper.setProps({ pathError: 'This path is already in use.' })
      await getSuffixInput(wrapper).vm.$emit('update:modelValue', typed)
      expect(getSuffixInput(wrapper).props('invalid')).toBe('This path is already in use.')
    })

    test('a new route says where visitors will reach the page', () => {
      const wrapper = mountManage({ currentPath: '', modelValue: '/conference/talks' })
      expect(wrapper.find('[data-testid="route-go-live-line"]').text()).toBe('Visitors will reach this page at /conference/talks.')
    })

    test('a new route starts Live, as the API makes it', () => {
      const wrapper = mountManage({ currentPath: '', modelValue: '', liveAt: undefined })
      expect(getStateSelect(wrapper).props('modelValue')).toBe('live')
      expect(wrapper.emitted('update:liveAt')).toBeUndefined()
    })

    test('taking a live route offline says visitors can no longer reach the page', async () => {
      const wrapper = mountManage({ liveAt: '2020-01-01T00:00:00+00:00' })
      expect(wrapper.find('[data-testid="route-go-live-line"]').exists()).toBe(false)
      await getStateSelect(wrapper).vm.$emit('update:modelValue', 'draft')
      expect(wrapper.find('[data-testid="route-go-live-line"]').text()).toBe('Visitors can no longer reach this page once you save.')
    })
  })

  describe('deleting', () => {
    test('is the last section of the form, saying what goes, and is not offered for a new route', async () => {
      const wrapper = mountManage({ redirectCount: 3 })
      const section = wrapper.findComponent('[data-testid="route-delete-section"]')
      expect(section.props('title')).toBe('Delete this route')
      expect(section.props('description')).toBe('Visitors to /conference/programme get “Page not found”. Its 3 old addresses go too.')
      await wrapper.findComponent('[data-testid="route-delete"]').vm.$emit('click')
      expect(wrapper.emitted('delete')).toHaveLength(1)

      expect(mountManage({ currentPath: '' }).findComponent('[data-testid="route-delete-section"]').exists()).toBe(false)
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

    test('says it is waiting for a date while scheduled has none, and stops once one is picked', async () => {
      const wrapper = mountManage({ liveAt: '2020-01-01T00:00:00+00:00' })
      expect(wrapper.emitted('update:awaitingDate')).toBeUndefined()
      await getStateSelect(wrapper).vm.$emit('update:modelValue', 'scheduled')
      await getLiveAtInput(wrapper).vm.$emit('update:modelValue', '2999-09-25T08:00:00.000Z')
      expect(wrapper.emitted('update:awaitingDate')).toEqual([[true], [false]])
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

    describe('once the parent date has passed', () => {
      afterEach(() => {
        vi.useRealTimers()
      })

      test('no longer says a parent route holds the page back (#378)', () => {
        vi.useFakeTimers().setSystemTime(new Date('2026-09-20T12:00:00.000Z'))
        const wrapper = mountManage({ liveAt: '2026-09-01T07:05:00Z', effectiveLiveAt: '2026-09-01T07:07:00Z' })
        expect(wrapper.find('[data-effective-live-at]').exists()).toBe(false)
        expect(wrapper.find('[data-live-since]').exists()).toBe(true)
      })
    })
  })
})

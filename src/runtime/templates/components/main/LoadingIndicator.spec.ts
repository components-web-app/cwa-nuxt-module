// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import { defineComponent } from 'vue'
import { shallowMount } from '@vue/test-utils'
import LoadingIndicator from './LoadingIndicator.vue'

const progress = vi.hoisted(() => ({ state: { resources: [] as string[], percent: 100 } }))
const currentRoute = vi.hoisted(() => ({ value: { meta: {} as Record<string, any> } }))

vi.mock('#cwa/composables/cwa', async () => {
  const { computed, reactive } = await vi.importActual<typeof import('vue')>('vue')
  progress.state = reactive(progress.state)
  return {
    useCwa: () => ({ resources: { pageLoadProgress: computed(() => ({ ...progress.state, total: progress.state.resources.length, complete: 0 })) } }),
  }
})

vi.mock('#app/composables/router', () => ({
  useRouter: () => ({ currentRoute }),
}))

const NuxtLoadingIndicator = defineComponent({
  name: 'NuxtLoadingIndicator',
  props: ['estimatedProgress', 'color', 'height', 'throttle', 'duration'],
  template: '<div />',
})

function mountIndicator(attrs: Record<string, any> = {}) {
  const wrapper = shallowMount(LoadingIndicator, { attrs, global: { stubs: { NuxtLoadingIndicator } } })
  const indicator = wrapper.findComponent(NuxtLoadingIndicator)
  return { indicator, estimatedProgress: indicator.props('estimatedProgress') as (duration: number, elapsed: number) => number }
}

function nuxtCurve(duration: number, elapsed: number) {
  return 2 / Math.PI * 100 * Math.atan(elapsed / duration * 100 / 50)
}

describe('CwaLoadingIndicator', () => {
  test('during a CWA page load the bar shows CWA\'s real percentage, never below 3 (#396)', () => {
    currentRoute.value = { meta: {} }
    const { estimatedProgress } = mountIndicator()
    progress.state.resources = ['/_/routes/a', '/_/pages/a', '/_/layouts/a', '/page_data/a']
    progress.state.percent = 0
    expect(estimatedProgress(2000, 1500)).toBe(3)
    progress.state.percent = 75
    expect(estimatedProgress(2000, 100)).toBe(75)
  })

  test('on a plain Nuxt page it shows Nuxt\'s own time-based estimate', () => {
    currentRoute.value = { meta: {} }
    const { estimatedProgress } = mountIndicator()
    progress.state.resources = []
    progress.state.percent = 100
    expect(estimatedProgress(2000, 1000)).toBeCloseTo(nuxtCurve(2000, 1000))
  })

  test('on a page with cwa.disabled it shows Nuxt\'s estimate even while a CWA fetch from the page left is running', () => {
    currentRoute.value = { meta: { cwa: { disabled: true } } }
    const { estimatedProgress } = mountIndicator()
    progress.state.resources = ['/_/routes/a']
    progress.state.percent = 0
    expect(estimatedProgress(2000, 1000)).toBeCloseTo(nuxtCurve(2000, 1000))
  })

  test('forwards its other props to NuxtLoadingIndicator', () => {
    const { indicator } = mountIndicator({ color: 'red', height: 5, throttle: 0, duration: 3000 })
    expect(indicator.props()).toMatchObject({ color: 'red', height: 5, throttle: 0, duration: 3000 })
  })
})

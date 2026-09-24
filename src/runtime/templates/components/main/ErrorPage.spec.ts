// @vitest-environment nuxt
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import ErrorPage from './ErrorPage.vue'

const mockRoute = reactive({ path: '/' })

mockNuxtImport('useRoute', () => () => mockRoute)
mockNuxtImport('useHead', () => () => {})
mockNuxtImport('clearError', () => () => {})
mockNuxtImport('navigateTo', () => () => {})

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({ auth: { hasRole: () => false } }),
}))

function createWrapper(error: Record<string, unknown>, path = '/') {
  mockRoute.path = path
  return mount(ErrorPage, {
    props: { error: error as never },
    global: {
      stubs: {
        CwaLogo: true,
        CwaUiBackgroundParticles: true,
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        ClientOnly: { template: '<div><slot /></div>' },
        CwaLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
}

const actions = (wrapper: ReturnType<typeof createWrapper>) => wrapper.find('[data-testid="error-actions"]')

describe('ErrorPage', () => {
  beforeEach(() => {
    mockRoute.path = '/'
  })

  test('a 404 at the site root says there is no page yet and offers a way in', () => {
    const wrapper = createWrapper({ statusCode: 404 })

    expect(wrapper.text()).toContain('No page here yet')
    expect(actions(wrapper).find('a[href="/login"]').exists()).toBe(true)
  })

  test('a 404 elsewhere does not offer a way in', () => {
    const wrapper = createWrapper({ statusCode: 404 }, '/typo')

    expect(wrapper.text()).toContain('This Page Doesn’t Exist')
    expect(actions(wrapper).find('a[href="/login"]').exists()).toBe(false)
    expect(actions(wrapper).text()).toContain('Go back home')
  })

  test('the owner footer link is not what the sign in assertions are reading', () => {
    const wrapper = createWrapper({ statusCode: 404 }, '/typo')

    expect(wrapper.html()).toContain('/login')
    expect(actions(wrapper).html()).not.toContain('/login')
  })

  test('a 401 still offers a way in', () => {
    const wrapper = createWrapper({ statusCode: 401 }, '/private')

    expect(actions(wrapper).find('a[href="/login"]').exists()).toBe(true)
  })

  test('an API that did not respond says so', () => {
    const wrapper = createWrapper({ statusCode: 504, data: { apiUnreachable: true } }, '/about')

    expect(wrapper.text()).toContain('isn’t responding yet')
  })

  test('a network failure arrives as a 500 and still says the API is not responding', () => {
    const wrapper = createWrapper({ statusCode: 500, message: '', data: { apiUnreachable: true } }, '/about')

    expect(wrapper.text()).toContain('isn’t responding yet')
    expect(wrapper.text()).not.toContain('Internal Server Error')
  })

  test('an unreachable API at the site root does not offer a way in, because signing in needs the API', () => {
    const wrapper = createWrapper({ statusCode: 500, data: { apiUnreachable: true } })

    expect(wrapper.text()).toContain('isn’t responding yet')
    expect(actions(wrapper).find('a[href="/login"]').exists()).toBe(false)
  })

  test('a maintenance 503 is not reported as an API failure', () => {
    const wrapper = createWrapper({
      statusCode: 503,
      statusMessage: 'Website under maintenance',
      message: 'We will be back up and running as soon as possible',
    }, '/about')

    expect(wrapper.text()).not.toContain('isn’t responding yet')
    expect(wrapper.text()).toContain('We will be back up and running as soon as possible')
  })

  test('error data that arrives as a json string is understood', () => {
    const wrapper = createWrapper({ statusCode: 502, data: '{"apiUnreachable":true}' }, '/about')

    expect(wrapper.text()).toContain('isn’t responding yet')
  })
})

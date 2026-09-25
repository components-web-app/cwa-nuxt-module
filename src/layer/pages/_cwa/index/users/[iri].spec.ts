// @vitest-environment nuxt
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import UserItemPage from './[iri].vue'
import * as cwaComposable from '#cwa/composables/cwa'

const { mockUseItemPage, mockUseResendVerifyEmail } = vi.hoisted(() => ({
  mockUseItemPage: vi.fn(),
  mockUseResendVerifyEmail: vi.fn(),
}))

vi.mock('#cwa-layer/_composables/useItemPage', () => ({
  useItemPage: mockUseItemPage,
}))

vi.mock('#cwa/composables/useResendVerifyEmail', () => ({
  useResendVerifyEmail: mockUseResendVerifyEmail,
}))

function setup(opts: { newEmailAddress?: string, emailAddressVerified?: boolean, error?: string, retryIn?: number } = {}) {
  const user = {
    '@id': '/users/uuid-user',
    '@type': 'User',
    'username': 'someone',
    'emailAddress': 'old@example.com',
    'emailAddressVerified': opts.emailAddressVerified ?? true,
    ...(opts.newEmailAddress ? { newEmailAddress: opts.newEmailAddress } : {}),
    'roles': ['ROLE_USER'],
  }
  const localResourceData = ref<any>({ ...user })
  const updateResource = vi.fn()
  const resendVerifyEmail = vi.fn()

  mockUseItemPage.mockReturnValue({
    isAdding: ref(false),
    isLoading: ref(false),
    isUpdating: ref(false),
    localResourceData,
    resource: ref(user),
    formatDate: vi.fn(() => '2026-01-01'),
    deleteResource: vi.fn(),
    saveResource: vi.fn(),
    saveTitle: vi.fn(),
  })
  mockUseResendVerifyEmail.mockReturnValue({
    resendVerifyEmail,
    submitting: ref(false),
    success: ref(false),
    error: ref(opts.error),
    retryIn: ref(opts.retryIn ?? 0),
  })

  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resourcesManager: { updateResource },
  }))

  const wrapper = mount(UserItemPage, {
    shallow: true,
    global: {
      stubs: {
        ResourceModalTabs: {
          props: ['tabs'],
          template: '<div><slot name="details" /><slot name="password" /><slot name="info" /></div>',
        },
        ResourceModal: {
          name: 'ResourceModal',
          template: '<div><slot name="title" /><slot /></div>',
        },
        TextButton: {
          props: ['disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
      },
    },
  })

  return { wrapper, localResourceData, updateResource, resendVerifyEmail }
}

describe('admin user page — email requests (#353)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('a pending email change can be cancelled, sending only the cleared address', async () => {
    const { wrapper, localResourceData, updateResource } = setup({ newEmailAddress: 'new@example.com' })
    localResourceData.value.username = 'edited-but-not-saved'

    await wrapper.find('[data-cancel-email-change]').trigger('click')
    await flushPromises()

    expect(updateResource).toHaveBeenCalledTimes(1)
    expect(updateResource).toHaveBeenCalledWith({
      endpoint: '/users/uuid-user',
      data: { newEmailAddress: null },
    })
    expect(localResourceData.value.newEmailAddress).toBeNull()
  })

  test('the cancel sits on the same line as the resend link', () => {
    const { wrapper } = setup({ newEmailAddress: 'new@example.com' })

    const cancel = wrapper.find('[data-cancel-email-change]')
    const resend = wrapper.find('[data-resend-email]')
    expect(cancel.element.parentElement).toBe(resend.element.parentElement)
  })

  test('with no pending change there is nothing to cancel', () => {
    const { wrapper } = setup({ emailAddressVerified: false })

    expect(wrapper.find('[data-cancel-email-change]').exists()).toBe(false)
  })

  test('a failed request says why', () => {
    const { wrapper } = setup({ newEmailAddress: 'new@example.com', error: 'A confirmation email was already sent. You can send another in 4 minutes.' })

    expect(wrapper.find('[data-email-request-error]').text()).toBe('A confirmation email was already sent. You can send another in 4 minutes.')
  })

  test.each([
    ['a pending change', { newEmailAddress: 'new@example.com' }],
    ['an unverified address', { emailAddressVerified: false }],
  ])('while throttled, resending %s is disabled with a countdown', (_, opts) => {
    const { wrapper } = setup({ ...opts, retryIn: 239 })

    const resend = wrapper.find('[data-resend-email]')
    expect(resend.attributes('disabled')).toBeDefined()
    expect(resend.text()).toContain('(3:59)')
  })

  test('once the wait is over, resending is available again', () => {
    const { wrapper } = setup({ newEmailAddress: 'new@example.com', retryIn: 0 })

    const resend = wrapper.find('[data-resend-email]')
    expect(resend.attributes('disabled')).toBeUndefined()
    expect(resend.text()).not.toContain('(')
  })
})

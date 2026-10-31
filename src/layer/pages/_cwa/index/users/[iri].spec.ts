// @vitest-environment nuxt
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import UserItemPage from './[iri].vue'
import * as cwaComposable from '#cwa/composables/cwa'
import ModalInput from '#cwa/templates/components/core/admin/form/ModalInput.vue'
import { ErrorType } from '#cwa/storage/stores/error/state'

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

vi.mock('vue-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue-router')>()
  return {
    ...mod,
    useRoute: () => ({ name: '_cwa-users-user-iri', params: { iri: '/users/uuid-user' }, query: {}, hash: '' }),
    useRouter: () => ({ push: vi.fn() }),
  }
})

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
    resourcesManager: { updateResource, errors: [] },
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

describe('admin user page — changing the email (#449)', () => {
  const userIri = '/users/uuid-user'
  const stored = {
    '@id': userIri,
    '@type': 'User',
    'username': 'someone',
    'enabled': true,
    'emailAddress': 'old@example.com',
    'emailAddressVerified': true,
    'roles': ['ROLE_USER'],
  }
  const modalStubs = {
    ResourceModalTabs: {
      props: ['tabs'],
      template: '<div><slot name="details" /><slot name="password" /><slot name="info" /></div>',
    },
    ResourceModal: {
      name: 'ResourceModal',
      template: '<div><slot name="title" /><slot /></div>',
    },
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    const { useItemPage } = await vi.importActual<typeof import('#cwa-layer/_composables/useItemPage')>('#cwa-layer/_composables/useItemPage')
    mockUseItemPage.mockImplementation(useItemPage)
    mockUseResendVerifyEmail.mockReturnValue({
      resendVerifyEmail: vi.fn(),
      submitting: ref(false),
      success: ref(false),
      error: ref(),
      retryIn: ref(0),
    })
  })

  async function setupRealItemPage(user: Record<string, any> = stored) {
    const store = reactive<Record<string, any>>({})
    const errors = ref<any[]>([])
    const updateResource = vi.fn(async ({ data }: { endpoint: string, data: Record<string, any> }) => {
      store[userIri].data = { ...store[userIri].data, ...data }
      return store[userIri].data
    })
    // @ts-expect-error partial mock
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
      resources: { getResource: vi.fn((iri: string) => computed(() => store[iri])) },
      resourcesManager: {
        updateResource,
        createResource: vi.fn(),
        deleteResource: vi.fn(),
        addError: vi.fn(),
        get errors() { return errors.value },
      },
      fetchResource: vi.fn(async () => {
        store[userIri] = { data: { ...user }, apiState: { status: 'SUCCESS' } }
        return store[userIri].data
      }),
    }))

    const wrapper = mount(UserItemPage, { shallow: true, global: { stubs: modalStubs } })
    await flushPromises()

    const field = (label: string) => wrapper.findAllComponents(ModalInput).find(input => input.props('label') === label)
    return { wrapper, store, errors, updateResource, field }
  }

  function saveButton(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAllComponents({ name: 'CwaUiFormButton' }).find(button => button.text() === 'Save')!
  }

  test('changing an existing user\'s email asks for your current password and sends it as `oldPassword` with `newEmailAddress`', async () => {
    const { wrapper, field, updateResource } = await setupRealItemPage()

    expect(field('Your current password')).toBeUndefined()

    field('Email')!.vm.$emit('update:modelValue', 'new@example.com')
    await flushPromises()

    const password = field('Your current password')
    expect(password).toBeDefined()
    expect(password!.props('type')).toBe('password')
    expect(password!.props('autocomplete')).toBe('current-password')

    password!.vm.$emit('update:modelValue', 'my-own-password')
    await flushPromises()
    await saveButton(wrapper).trigger('click')
    await flushPromises()

    expect(updateResource).toHaveBeenCalledTimes(1)
    expect(updateResource).toHaveBeenCalledWith({
      endpoint: userIri,
      data: { newEmailAddress: 'new@example.com', oldPassword: 'my-own-password' },
    })
  })

  test('the password is not kept after a successful save', async () => {
    const { wrapper, field, updateResource } = await setupRealItemPage()

    field('Email')!.vm.$emit('update:modelValue', 'new@example.com')
    await flushPromises()
    field('Your current password')!.vm.$emit('update:modelValue', 'my-own-password')
    await flushPromises()
    await saveButton(wrapper).trigger('click')
    await flushPromises()

    expect(field('Your current password')).toBeUndefined()

    field('Email')!.vm.$emit('update:modelValue', 'newer@example.com')
    await flushPromises()
    expect(field('Your current password')!.props('modelValue')).toBeFalsy()

    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(updateResource).toHaveBeenLastCalledWith({
      endpoint: userIri,
      data: { newEmailAddress: 'newer@example.com' },
    })
  })

  test('a field other than Email changed alone sends no password', async () => {
    const { wrapper, updateResource } = await setupRealItemPage()

    wrapper.findComponent({ name: 'CwaUiFormToggle' }).vm.$emit('update:modelValue', false)
    await flushPromises()
    await saveButton(wrapper).trigger('click')
    await flushPromises()

    expect(updateResource).toHaveBeenCalledWith({ endpoint: userIri, data: { enabled: false } })
  })

  test('an email edited back to the pending address sends no password', async () => {
    const { wrapper, field, updateResource } = await setupRealItemPage({ ...stored, newEmailAddress: 'pending@example.com' })

    field('Email')!.vm.$emit('update:modelValue', 'other@example.com')
    await flushPromises()
    field('Your current password')!.vm.$emit('update:modelValue', 'my-own-password')
    field('Email')!.vm.$emit('update:modelValue', 'pending@example.com')
    await flushPromises()
    expect(field('Your current password')).toBeUndefined()

    wrapper.findComponent({ name: 'CwaUiFormToggle' }).vm.$emit('update:modelValue', false)
    await flushPromises()
    await saveButton(wrapper).trigger('click')
    await flushPromises()

    expect(updateResource).toHaveBeenCalledWith({ endpoint: userIri, data: { enabled: false } })
  })

  test('a 422 on `oldPassword` shows its message on that field', async () => {
    const { wrapper, field, errors } = await setupRealItemPage()

    field('Email')!.vm.$emit('update:modelValue', 'new@example.com')
    await flushPromises()
    expect(wrapper.find('[data-old-password-error]').exists()).toBe(false)

    errors.value = [{
      type: ErrorType.VALIDATION,
      statusCode: 422,
      timestamp: 1,
      detail: 'oldPassword: This value should be the user\'s current password.',
      event: { endpoint: userIri },
      violations: [{ property: 'oldPassword', message: 'This value should be the user\'s current password.' }],
    }]
    await flushPromises()

    const message = wrapper.find('[data-old-password-error]')
    expect(message.text()).toBe('This value should be the user\'s current password.')
    expect(message.element.previousElementSibling).toBe(field('Your current password')!.element.parentElement)
  })

  test('a 422 on another resource\'s `oldPassword` is not shown', async () => {
    const { wrapper, field, errors } = await setupRealItemPage()

    field('Email')!.vm.$emit('update:modelValue', 'new@example.com')
    errors.value = [{
      type: ErrorType.VALIDATION,
      statusCode: 422,
      timestamp: 1,
      detail: '',
      event: { endpoint: '/users/someone-else' },
      violations: [{ property: 'oldPassword', message: 'Wrong password.' }],
    }]
    await flushPromises()

    expect(wrapper.find('[data-old-password-error]').exists()).toBe(false)
  })

  test('cancelling a pending change still sends only `{ newEmailAddress: null }`', async () => {
    const { wrapper, field, updateResource } = await setupRealItemPage({ ...stored, newEmailAddress: 'pending@example.com' })

    expect(field('Your current password')).toBeUndefined()

    await wrapper.find('[data-cancel-email-change]').trigger('click')
    await flushPromises()

    expect(updateResource).toHaveBeenCalledTimes(1)
    expect(updateResource).toHaveBeenCalledWith({
      endpoint: userIri,
      data: { newEmailAddress: null },
    })
  })
})

// @vitest-environment nuxt
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { axe } from '../../../../../test/utils/axe'
import FormGroup from '../core/ui/FormGroup.vue'
import type { CwaFieldDescriptor } from '../core/ui/field-descriptors'
import { useItemPage } from '../../../../layer/_composables/useItemPage'
import * as cwaComposable from '#cwa/composables/cwa'
import DescriptorFields from './DescriptorFields.vue'

vi.mock('#cwa/composables/cwa-confirm', () => ({ useCwaConfirm: () => vi.fn() }))
vi.mock('#cwa/composables/cwa-toast', () => ({ useCwaToast: () => ({ show: vi.fn(), dismiss: vi.fn() }) }))

enableAutoUnmount(afterEach)

const iri = '/payment_methods/card'

const descriptors: CwaFieldDescriptor[] = [
  { name: 'vendor', label: 'Vendor name', type: 'string', required: true },
  { name: 'sandbox', label: 'Sandbox', type: 'bool' },
  { name: 'retries', label: 'Retries', type: 'int' },
  { name: 'notes', label: 'Notes', type: 'text' },
  { name: 'key', label: 'Integration key', type: 'string', required: true, secret: true },
]

async function mountForm() {
  const stored = { '@id': iri, '@type': 'PaymentMethod', 'gatewayConfig': { vendor: 'shop', sandbox: true, retries: 2, notes: '', key: { set: true } } }
  const store = reactive<Record<string, any>>({ [iri]: { data: stored, apiState: { status: 'SUCCESS' } } })
  const updateResource = vi.fn()
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: { getResource: vi.fn((id: string) => computed(() => store[id])) },
    resourcesManager: { createResource: vi.fn(), updateResource, deleteResource: vi.fn(), addError: vi.fn(), errors: [], removeError: vi.fn(), storeResource: vi.fn() },
    fetchResource: vi.fn(),
  }))
  const page = defineComponent({
    setup() {
      const { form, saveResource } = useItemPage({ createEndpoint: '/payment_methods', emit: vi.fn() as any, defaultResource: {}, endpoint: ref(iri) })
      return () => h(FormGroup, { form, onSave: () => saveResource() }, {
        default: () => h(DescriptorFields, { fields: descriptors, path: 'gatewayConfig' }),
      })
    },
  })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: page }] })
  await router.push('/')
  await router.isReady()
  mount({ render: () => h(RouterView) }, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return { updateResource }
}

const field = (path: string) => document.querySelector<HTMLElement>(`[data-cwa-field="${path}"]`)
const saveButton = () => document.querySelector<HTMLButtonElement>('[data-testid="form-group-save"]')!

async function type(path: string, value: string, tag = 'input') {
  const control = field(path)!.querySelector<HTMLInputElement>(tag)!
  control.value = value
  control.dispatchEvent(new Event('input'))
  await flushPromises()
}

describe('CwaUiDescriptorFields (#494)', () => {
  test('renders one labelled control per descriptor, bound to its path', async () => {
    await mountForm()

    expect(field('gatewayConfig.vendor')!.querySelector('label')!.textContent).toBe('Vendor name')
    expect(field('gatewayConfig.vendor')!.querySelector<HTMLInputElement>('input')!.value).toBe('shop')
    expect(field('gatewayConfig.sandbox')!.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('true')
    expect(field('gatewayConfig.retries')!.querySelector<HTMLInputElement>('input')!.value).toBe('2')
    expect(field('gatewayConfig.notes')!.querySelector('textarea')).not.toBeNull()
    expect(field('gatewayConfig.key')!.querySelector('[data-testid="secret-status"]')!.textContent!.trim()).toBe('Set')
  })

  test('a descriptor that is not required is optional', async () => {
    await mountForm()

    expect(field('gatewayConfig.vendor')!.textContent).not.toContain('Optional')
    expect(field('gatewayConfig.notes')!.textContent).toContain('Optional')
  })

  test('each field typed into counts as one change on Save', async () => {
    await mountForm()

    await type('gatewayConfig.vendor', 'shop2')
    await type('gatewayConfig.notes', 'Hello', 'textarea')

    expect(saveButton().textContent).toContain('Save 2 changes')
  })

  test('a 422 on a field shows on that field', async () => {
    const { updateResource } = await mountForm()
    updateResource.mockImplementationOnce(async (event: any) => {
      const error = Object.assign(new Error('failed'), { statusCode: 422, data: { violations: [{ propertyPath: 'gatewayConfig.vendor', message: 'Unknown vendor.' }] } })
      event.onRequest?.(iri, Promise.resolve({ error }))
      return undefined
    })
    await type('gatewayConfig.vendor', 'nope')

    saveButton().click()
    await flushPromises()

    expect(updateResource.mock.calls[0]![0].data).toEqual({ gatewayConfig: { vendor: 'nope' } })
    expect(field('gatewayConfig.vendor')!.querySelector('input')!.getAttribute('aria-invalid')).toBe('true')
    expect(field('gatewayConfig.vendor')!.querySelector('[data-testid="field-error"]')!.textContent).toContain('Unknown vendor.')
  })

  test('has no accessibility violations', async () => {
    await mountForm()

    expect(await axe(document.body)).toHaveNoViolations()
  })
})

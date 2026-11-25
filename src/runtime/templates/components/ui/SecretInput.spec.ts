// @vitest-environment nuxt
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { axe } from '../../../../../test/utils/axe'
import { fakeDialogForm } from '../../../../../playground/app/kit/fake-dialog-form'
import type { FakeDialogForm } from '../../../../../playground/app/kit/fake-dialog-form'
import { fakeFieldModel } from '../../../../../playground/app/kit/fake-field-model'
import FormGroup from '../core/ui/FormGroup.vue'
import SecretInput from './SecretInput.vue'

vi.mock('#cwa/composables/cwa-confirm', () => ({ useCwaConfirm: () => vi.fn() }))

enableAutoUnmount(afterEach)

async function mountForm(stored: unknown, props: Record<string, unknown> = {}) {
  const form = fakeDialogForm({ secret: stored })
  const page = defineComponent({
    setup: () => () => h(FormGroup, { form, onSave: () => form.save() }, {
      default: () => h(SecretInput, { label: 'Integration key', field: 'secret', ...props }),
    }),
  })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: page }] })
  await router.push('/')
  await router.isReady()
  mount({ render: () => h(RouterView) }, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return form
}

const q = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)
const input = () => q<HTMLInputElement>('[data-cwa-field="secret"] input')
const status = () => q('[data-testid="secret-status"]')?.textContent?.trim()

async function click(testId: string) {
  q<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click()
  await flushPromises()
}

async function type(value: string) {
  input()!.value = value
  input()!.dispatchEvent(new Event('input'))
  await flushPromises()
}

async function save(form: FakeDialogForm) {
  await form.save()
  await flushPromises()
}

describe('CwaUiSecretInput (#494)', () => {
  test('a set secret shows Set with Replace and Remove, and no input', async () => {
    await mountForm({ set: true })

    expect(status()).toBe('Set')
    expect(q('[data-testid="secret-replace"]')).not.toBeNull()
    expect(q('[data-testid="secret-remove"]')).not.toBeNull()
    expect(input()).toBeNull()
  })

  test('a secret that is not set shows the input, and offers neither Replace nor Remove', async () => {
    await mountForm({ set: false })

    expect(input()).not.toBeNull()
    expect(q('[data-testid="secret-replace"]')).toBeNull()
    expect(q('[data-testid="secret-remove"]')).toBeNull()
  })

  test('Replace shows an empty password input the browser never fills with a saved password', async () => {
    await mountForm({ set: true })

    await click('secret-replace')

    expect(input()!.value).toBe('')
    expect(input()!.type).toBe('password')
    expect(input()!.autocomplete).toBe('new-password')
    expect(document.activeElement).toBe(input())
  })

  test('Replace offers Show value, which shows what was typed and hides it again', async () => {
    await mountForm({ set: true })
    await click('secret-replace')
    await type('s3cret')

    const reveal = () => q<HTMLButtonElement>('[data-testid="secret-reveal"]')!
    expect(reveal().getAttribute('aria-label')).toBe('Show value')
    expect(reveal().getAttribute('aria-pressed')).toBe('false')

    await click('secret-reveal')
    expect(input()!.type).toBe('text')
    expect(reveal().getAttribute('aria-label')).toBe('Hide value')
    expect(reveal().getAttribute('aria-pressed')).toBe('true')

    await click('secret-reveal')
    expect(input()!.type).toBe('password')
  })

  test('typing makes it unsaved, and Keep current puts the stored value back and sends nothing', async () => {
    const form = await mountForm({ set: true })
    await click('secret-replace')

    await type('s3cret')
    expect(form.unsavedFields).toEqual(['secret'])

    await click('secret-keep')
    expect(form.unsavedFields).toEqual([])
    expect(form.local.secret).toEqual({ set: true })
    expect(status()).toBe('Set')
  })

  test('emptying the input again sends nothing, never an empty string', async () => {
    const form = await mountForm({ set: true })
    await click('secret-replace')

    await type('s3cret')
    await type('')

    expect(form.local.secret).toEqual({ set: true })
    expect(form.unsavedFields).toEqual([])
    expect(input()).not.toBeNull()
  })

  test('a typed value is saved as typed', async () => {
    const form = await mountForm({ set: false })

    await type('s3cret')
    await save(form)

    expect(form.saves).toEqual([{ secret: 's3cret' }])
  })

  test('Remove sends null, and shows Will be removed until it is saved', async () => {
    const form = await mountForm({ set: true })

    await click('secret-remove')
    expect(status()).toBe('Will be removed')
    expect(form.unsavedFields).toEqual(['secret'])

    await save(form)
    expect(form.saves).toEqual([{ secret: null }])
  })

  test('Keep current after Remove sends nothing', async () => {
    const form = await mountForm({ set: true })

    await click('secret-remove')
    await click('secret-keep')

    expect(form.unsavedFields).toEqual([])
    expect(status()).toBe('Set')
  })

  test('Remove is disabled with its reason for a required secret', async () => {
    const form = await mountForm({ set: true }, { required: true })
    const remove = q<HTMLButtonElement>('[data-testid="secret-remove"]')!

    expect(remove.getAttribute('aria-disabled')).toBe('true')
    expect(remove.getAttribute('title')).toBe('Required: replace it instead')

    await click('secret-remove')
    expect(form.unsavedFields).toEqual([])
    expect(status()).toBe('Set')
  })

  test('the conflict view names the values, never the typed text', async () => {
    const form = await mountForm({ set: true })
    await click('secret-replace')
    await type('s3cret')
    form.conflictNext({ secret: { set: true } })

    await save(form)

    const notice = q('[data-testid="conflict-notice"]')!.textContent!
    expect(notice).toContain('Set')
    expect(notice).toContain('New value')
    const copy = document.body.cloneNode(true) as HTMLElement
    copy.querySelectorAll('input').forEach(each => each.remove())
    expect(copy.innerHTML).not.toContain('s3cret')
  })

  test('outside a form, its status popover names the values, never the typed text', async () => {
    vi.useFakeTimers()
    try {
      mount(defineComponent({
        setup: () => () => h(SecretInput, { label: 'Integration key', model: fakeFieldModel<any>('s3cret', 'conflict', { set: true }) }),
      }), { attachTo: document.body })
      await vi.advanceTimersByTimeAsync(0)
      const box = q('input')!.closest<HTMLElement>('.cwa\\:relative:not(.cwa\\:group\\/field)')!

      box.dispatchEvent(new MouseEvent('mouseenter'))
      await vi.advanceTimersByTimeAsync(310)

      const popover = q('[data-testid="field-status-popover"]')!
      expect(popover.textContent).toContain('New value')
      const copy = document.body.cloneNode(true) as HTMLElement
      copy.querySelectorAll('input').forEach(each => each.remove())
      expect(copy.innerHTML).not.toContain('s3cret')
    }
    finally {
      vi.useRealTimers()
    }
  })

  test.each([
    ['set', { set: true }, undefined],
    ['not set', { set: false }, undefined],
    ['replacing', { set: true }, 'secret-replace'],
    ['removed', { set: true }, 'secret-remove'],
  ])('has no accessibility violations when %s', async (_name, stored, press) => {
    await mountForm(stored)
    press && await click(press)

    expect(await axe(document.body)).toHaveNoViolations()
  })
})

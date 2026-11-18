// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createSSRApp, defineComponent, h, provide, ref } from 'vue'
import type { Ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { axe } from '../../../../../test/utils/axe'
import { fieldGroupKey, formSurfaceKey } from '../core/ui/field-keys'
import Input from './Input.vue'

enableAutoUnmount(afterEach)

describe('CwaUiInput (#459)', () => {
  test('is a text field named by its label that reports what is typed', async () => {
    const wrapper = mount(Input, { props: { label: 'Title', modelValue: 'Old' } })
    const input = wrapper.get('input')

    expect(wrapper.get(`label[for="${input.attributes('id')}"]`).text()).toBe('Title')
    expect(input.element.value).toBe('Old')
    await input.setValue('New')
    expect(wrapper.emitted('update:modelValue')).toEqual([['New']])
  })

  test('a nullable field reports an emptied value as null, others as an empty string', async () => {
    const nullable = mount(Input, { props: { label: 'Subtitle', modelValue: 'x', nullable: true } })
    await nullable.get('input').setValue('')
    expect(nullable.emitted('update:modelValue')).toEqual([[null]])

    const plain = mount(Input, { props: { label: 'Subtitle', modelValue: 'x' } })
    await plain.get('input').setValue('')
    expect(plain.emitted('update:modelValue')).toEqual([['']])
  })

  test('a hidden label still names the field, and prefix and suffix sit in the box', () => {
    const wrapper = mount(Input, {
      props: { label: 'Search', labelHidden: true, modelValue: '' },
      slots: { prefix: () => h('span', { 'data-testid': 'prefix' }, '#'), suffix: () => h('span', { 'data-testid': 'suffix' }, 'px') },
    })

    expect(wrapper.get('label').classes()).toContain('cwa:sr-only')
    const box = wrapper.get('input').element.parentElement!
    expect(box.querySelector('[data-testid="prefix"]')).not.toBeNull()
    expect(box.querySelector('[data-testid="suffix"]')).not.toBeNull()
  })

  test('has no axe violations', async () => {
    const wrapper = mount(Input, { props: { label: 'Title', description: 'Shown as the heading.', modelValue: 'x' }, attachTo: document.body })

    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  describe('a value the browser filled into the server-rendered input before hydration (#386)', () => {
    type Binding = { kind: 'v-model' } | { kind: 'model' } | { kind: 'field' }

    function inputApp(model: Ref<string>, props: Record<string, unknown>, binding: Binding, writes: string[] = []) {
      const resourceModel = {
        model: {
          get value() {
            return model.value
          },
          set value(next: string) {
            writes.push(next)
            model.value = next
          },
        },
        remoteChange: { value: undefined },
      }
      return createSSRApp(defineComponent({
        setup() {
          provide(fieldGroupKey, { model: () => resourceModel, undo: () => undefined })
          return () => h(Input, {
            label: 'Username',
            name: 'username',
            ...props,
            ...(binding.kind === 'v-model'
              ? {
                  'modelValue': model.value,
                  'onUpdate:modelValue': (value: string) => {
                    writes.push(value)
                    model.value = value
                  },
                }
              : binding.kind === 'model' ? { model: resourceModel } : { field: 'title' }),
          })
        },
      }))
    }

    async function hydrate(initial: string, filled: string | undefined, props: Record<string, unknown> = { autocomplete: 'username' }, binding: Binding = { kind: 'v-model' }) {
      const container = document.createElement('div')
      document.body.appendChild(container)
      container.innerHTML = await renderToString(inputApp(ref(initial), props, binding))
      const input = container.querySelector('input') as HTMLInputElement
      if (filled !== undefined) {
        input.value = filled
      }
      const writes: string[] = []
      const model = ref(initial)
      const app = inputApp(model, props, binding, writes)
      app.mount(container)
      await flushPromises()
      return { input, model, writes, unmount: () => app.unmount() }
    }

    test('is kept in the input and written to the model, as a password manager on /login needs', async () => {
      const { input, model, unmount } = await hydrate('', 'autofilled-user')

      expect(input.value).toBe('autofilled-user')
      expect(model.value).toBe('autofilled-user')
      unmount()
    })

    test('is kept for an app\'s v-model password field that sets no autocomplete', async () => {
      const { input, model, unmount } = await hydrate('', 'filled-secret', { type: 'password', name: 'password' })

      expect(input.value).toBe('filled-secret')
      expect(model.value).toBe('filled-secret')
      unmount()
    })

    test('is not read for a v-model field with autocomplete off', async () => {
      const { writes, unmount } = await hydrate('', 'Restored by the browser', { autocomplete: 'off' })

      expect(writes).toEqual([])
      unmount()
    })

    test.each([
      ['bound with :model', { kind: 'model' } as Binding],
      ['bound with field', { kind: 'field' } as Binding],
    ])('a resource field %s never takes a value the browser restored, even with autocomplete', async (_name, binding) => {
      const { input, writes, unmount } = await hydrate('Stored title', 'Restored by the browser', { autocomplete: 'username' }, binding)

      expect(writes).toEqual([])
      expect(input.value).toBe('Stored title')
      unmount()
    })

    test('writes nothing when the input still holds the server-rendered value', async () => {
      const { writes, unmount } = await hydrate('admin', undefined)

      expect(writes).toEqual([])
      unmount()
    })

    test('a client-side mount does not overwrite the model with the empty new input', () => {
      const wrapper = mount(Input, { props: { label: 'Username', autocomplete: 'username', modelValue: 'admin' } })

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(wrapper.get('input').element.value).toBe('admin')
    })
  })

  test('name, autocomplete and required reach the native input, for password managers and the browser\'s own check', () => {
    const wrapper = mount(Input, { props: { label: 'Password', type: 'password', name: 'password', autocomplete: 'current-password', required: true, modelValue: '' } })
    const input = wrapper.get('input')

    expect(input.attributes('name')).toBe('password')
    expect(input.attributes('autocomplete')).toBe('current-password')
    expect(input.attributes('type')).toBe('password')
    expect(input.element.required).toBe(true)
  })

  describe('on a page or modal surface', () => {
    function onSurface(props: Record<string, unknown>) {
      return mount(defineComponent({
        setup() {
          provide(formSurfaceKey, { unsaved: () => false, register: () => () => {} })
          return () => h(Input, props)
        },
      }), { attachTo: document.body })
    }

    test('invalid is the error line below the field, describes the input and tints the field', async () => {
      const wrapper = onSurface({ label: 'New password', modelValue: 'abc', invalid: 'Use at least 8 characters.' })
      const input = wrapper.get('input')
      const line = wrapper.get('[data-testid="field-error"]')

      expect(line.text()).toBe('Use at least 8 characters.')
      expect(input.attributes('aria-describedby')?.split(' ')).toContain(line.attributes('id'))
      expect(input.attributes('aria-invalid')).toBe('true')
      expect(input.element.parentElement!.classList).toContain('cwa:bg-field-danger')
      expect(wrapper.find('[data-testid="input-invalid"]').exists()).toBe(false)
      expect(await axe(document.body)).toHaveNoViolations()
    })

    test('without invalid it has no error line and an untinted fill', async () => {
      const wrapper = onSurface({ label: 'New password', modelValue: 'abc' })

      expect(wrapper.find('[data-testid="field-error"]').exists()).toBe(false)
      expect(wrapper.get('input').element.parentElement!.classList).not.toContain('cwa:bg-field-danger')
      expect(await axe(document.body)).toHaveNoViolations()
    })
  })
})

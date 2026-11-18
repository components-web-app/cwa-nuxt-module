// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, provide, ref } from 'vue'
import { consola } from 'consola'
import { axe } from '../../../../../test/utils/axe'
import { formSurfaceKey, managerTabKey } from '../core/ui/field-keys'
import Textarea from './Textarea.vue'
import Alert from './Alert.vue'
import FormSection from './FormSection.vue'

enableAutoUnmount(afterEach)

function inModal(render: () => any, unsaved: string[] = []) {
  return mount(defineComponent({
    setup() {
      provide(formSurfaceKey, { unsaved: field => unsaved.includes(field), register: () => () => {} })
      return render
    },
  }), { attachTo: document.body })
}

describe('CwaUiTextarea (#461)', () => {
  test('is a labelled textarea with no resize handle that grows from 3 lines to maxRows, then scrolls', () => {
    const wrapper = inModal(() => h(Textarea, { label: 'SEO meta description', modelValue: 'Hand-built', maxRows: 6 }))
    const textarea = wrapper.get<HTMLTextAreaElement>('textarea')

    expect(document.querySelector(`label[for="${textarea.attributes('id')}"]`)?.textContent).toBe('SEO meta description')
    expect(textarea.classes()).toEqual(expect.arrayContaining(['cwa:resize-none', 'cwa:[field-sizing:content]']))
    expect(textarea.element.style.minHeight).toBe('5rem')
    expect(textarea.element.style.maxHeight).toBe('8.75rem')
    expect(textarea.element.value).toBe('Hand-built')
  })

  test('the counter reads the length against maxlength and is linked to the textarea', () => {
    const wrapper = inModal(() => h(Textarea, { label: 'Description', modelValue: 'Hand-built kitchens', maxlength: 160, counter: true }))
    const counter = wrapper.get('[data-testid="textarea-counter"]')

    expect(counter.text()).toBe('19 / 160')
    expect(wrapper.get('textarea').attributes('aria-describedby')).toContain(counter.attributes('id'))
  })

  test('v-model emits what is typed', async () => {
    const value = ref('a')
    const wrapper = inModal(() => h(Textarea, { 'label': 'Notes', 'modelValue': value.value, 'onUpdate:modelValue': (next: string) => (value.value = next) }))

    await wrapper.get('textarea').setValue('abc')

    expect(value.value).toBe('abc')
  })

  test('in a modal, its unsaved marker and an error below come from the field state', async () => {
    const model = { field: 'metaDescription', model: ref('x'), remoteChange: ref(undefined), state: ref({ status: 'error', waiting: false, slow: false, error: { kind: 'violation', message: 'Use 160 characters or fewer.' } }) }
    const wrapper = inModal(() => h(Textarea, { label: 'Description', model }), ['metaDescription'])

    expect(wrapper.find('[data-testid="field-unsaved"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="field-error"]').text()).toBe('Use 160 characters or fewer.')
    expect(wrapper.get('textarea').attributes('aria-invalid')).toBe('true')
    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('in the manager bar it renders nothing and says why in development', () => {
    const error = vi.spyOn(consola, 'error').mockImplementation(() => {})
    const wrapper = mount(defineComponent({
      setup() {
        provide(managerTabKey, { iri: ref('/component/x'), register: () => {} })
        return () => h(Textarea, { label: 'Notes', modelValue: 'x' })
      },
    }))

    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('CwaUiTextarea is for modals and pages'))
    error.mockRestore()
  })
})

describe('CwaUiAlert (#461)', () => {
  test.each([
    ['danger', 'error', 'cwa:border-danger-fg'],
    ['warning', 'conflict', 'cwa:border-warning'],
  ] as const)('a %s alert is a group named by its title, with a %s glyph and a 3px tone edge', async (tone, glyph, edge) => {
    const wrapper = mount(Alert, { props: { tone, title: 'This page wasn\'t saved.' }, slots: { default: 'Details' }, attachTo: document.body })

    expect(wrapper.attributes('role')).toBe('group')
    expect(document.getElementById(wrapper.attributes('aria-labelledby')!)?.textContent?.trim()).toBe('This page wasn\'t saved.')
    expect(wrapper.find(`[data-glyph="${glyph}"]`).exists()).toBe(true)
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:border-s-3', edge]))
    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('an info alert is the field tint with no edge', () => {
    const wrapper = mount(Alert, { props: { title: 'Note' } })

    expect(wrapper.classes()).toContain('cwa:bg-field')
    expect(wrapper.classes()).not.toContain('cwa:border-s-3')
  })

  test('can take focus, for a failed Save', () => {
    const wrapper = mount(Alert, { props: { tone: 'danger', title: 'Not saved' }, attachTo: document.body })

    ;(wrapper.vm as unknown as { focus: () => void }).focus()

    expect(document.activeElement).toBe(wrapper.element)
  })
})

describe('CwaUiFormSection (#461)', () => {
  test('a titled section is named by its h3 heading in fg-secondary, with its description below', async () => {
    const wrapper = mount(FormSection, { props: { title: 'Search engines', description: 'What people see in search results.' }, slots: { default: '<p>field</p>' }, attachTo: document.body })
    const heading = wrapper.get('h3')

    expect(heading.text()).toBe('Search engines')
    expect(heading.classes()).toEqual(expect.arrayContaining(['cwa:text-section', 'cwa:text-fg-secondary']))
    expect(wrapper.attributes('aria-labelledby')).toBe(heading.attributes('id'))
    expect(wrapper.text()).toContain('What people see in search results.')
    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('two columns collapse to one when the section is narrow', () => {
    const grid = mount(FormSection, { props: { columns: 2 } }).get('.cwa\\:grid')

    expect(grid.classes()).toEqual(expect.arrayContaining(['cwa:grid-cols-1', 'cwa:@lg:grid-cols-2']))
  })

  test('a section after the first has a rule and the section space above it', () => {
    expect(mount(FormSection).classes()).toEqual(expect.arrayContaining(['cwa:not-first:border-t', 'cwa:not-first:mt-section', 'cwa:not-first:pt-section']))
  })
})

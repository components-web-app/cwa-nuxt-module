// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../test/utils/focus-ring'
import { findInlineEditor, openInlineEditor, registerBarStatus } from '#cwa/admin/inline-editors'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'
import type { RemoteFieldChange, ResourceModelField } from '#cwa/resources/model-editors'
import InlineEdit from './InlineEdit.vue'

const cwa = vi.hoisted(() => ({ resources: { isIriPublishableEquivalent: () => false } }))
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => cwa }))

enableAutoUnmount(afterEach)

afterEach(() => {
  document.body.innerHTML = ''
})

function fieldModel(initial: string | null, remote?: RemoteFieldChange<string>, status: CwaFieldState['status'] = 'idle') {
  const focusin = vi.fn()
  const state = ref<CwaFieldState>({ status, waiting: false, slow: false })
  const model: ResourceModelField<string> = {
    model: ref(initial),
    state,
    remoteChange: computed(() => remote),
    focusListeners: { onFocusin: focusin, onFocusout: vi.fn(), onPointerdown: vi.fn() },
    editorKey: { iri: () => '/component/title', field: 'title' },
  }
  return { model, focusin, state }
}

function mountEdit(initial: string | null = 'How we build a kitchen', props: Record<string, unknown> = {}, status?: CwaFieldState['status']) {
  const field = fieldModel(initial, undefined, status)
  const wrapper = mount(InlineEdit, { props: { model: field.model, label: 'Title', ...props }, attachTo: document.body })
  return { wrapper, ...field }
}

function shown(wrapper: ReturnType<typeof mountEdit>['wrapper']) {
  return wrapper.get<HTMLElement>('[data-testid="inline-edit-value"]')
}

async function startEditing(wrapper: ReturnType<typeof mountEdit>['wrapper']) {
  await shown(wrapper).trigger('click')
  await flushPromises()
  return wrapper.get<HTMLInputElement>('input')
}

describe('CwaUiInlineEdit (#461)', () => {
  test('shows the value as text in the page\'s own font, named as an edit control', () => {
    const { wrapper } = mountEdit()

    expect(shown(wrapper).text()).toBe('How we build a kitchen')
    expect(shown(wrapper).attributes('role')).toBe('button')
    expect(shown(wrapper).attributes('tabindex')).toBe('0')
    expect(shown(wrapper).attributes('aria-label')).toBe('Edit Title: How we build a kitchen')
    expect(wrapper.find('input').exists()).toBe(false)
  })

  test('an empty value shows the placeholder, muted', () => {
    const { wrapper } = mountEdit(null, { placeholder: 'Add a title' })

    expect(shown(wrapper).text()).toBe('Add a title')
    expect(shown(wrapper).classes()).toContain('cwa:opacity-60')
  })

  test('a click or Enter turns it into an input holding the value, focused, named by its label', async () => {
    const { wrapper } = mountEdit()
    const input = await startEditing(wrapper)

    expect(input.element.value).toBe('How we build a kitchen')
    expect(document.activeElement).toBe(input.element)
    expect(input.attributes('aria-label')).toBe('Title')
    await input.trigger('keydown', { key: 'Escape' })

    await shown(wrapper).trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.find('input').exists()).toBe(true)
  })

  test('the clicked text stays in the document, hidden, while editing, so the page click that started editing still selects its component', async () => {
    const { wrapper } = mountEdit()
    const value = shown(wrapper).element
    await startEditing(wrapper)

    expect(value.isConnected).toBe(true)
    expect(value.style.display).toBe('none')
  })

  test('Enter commits the typed value to the model and shows it', async () => {
    const { wrapper, model } = mountEdit()
    const input = await startEditing(wrapper)
    await input.setValue('How we fit a kitchen')
    expect(model.model.value).toBe('How we build a kitchen')

    await input.trigger('keydown', { key: 'Enter' })

    expect(model.model.value).toBe('How we fit a kitchen')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(shown(wrapper).text()).toBe('How we fit a kitchen')
    expect(document.activeElement).toBe(shown(wrapper).element)
  })

  test('Escape reverts without saving, and stops there so it never deselects the component', async () => {
    const { wrapper, model } = mountEdit()
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    const input = await startEditing(wrapper)
    await input.setValue('Something else')

    await input.trigger('keydown', { key: 'Escape' })
    await flushPromises()

    expect(model.model.value).toBe('How we build a kitchen')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(outer).not.toHaveBeenCalled()
    document.removeEventListener('keydown', outer)
  })

  test('while its save has failed the editor is invalid, says Escape leads to Retry and Reset, and Escape reverts and opens the bar status on Retry', async () => {
    const { wrapper, model, state } = mountEdit('How we build a kitchen', {}, 'error')
    const open = vi.fn(() => true)
    const unregister = registerBarStatus(cwa, { open })
    const input = await startEditing(wrapper)

    expect(input.attributes('aria-invalid')).toBe('true')
    const described = document.getElementById(input.attributes('aria-describedby')!)
    expect(described?.textContent).toBe('Not saved. Press Escape for Retry and Reset.')
    expect(shown(wrapper).attributes('aria-invalid')).toBe('true')

    await input.setValue('Something else')
    await input.trigger('keydown', { key: 'Escape' })
    await flushPromises()

    expect(model.model.value).toBe('How we build a kitchen')
    expect(open).toHaveBeenCalledExactlyOnceWith('title')
    expect(document.activeElement).not.toBe(shown(wrapper).element)

    state.value = { status: 'saving', waiting: false, slow: false }
    await nextTick()
    expect(shown(wrapper).attributes('aria-invalid')).toBeUndefined()
    expect(shown(wrapper).attributes('aria-describedby')).toBeUndefined()
    unregister()
  })

  test('Escape stays on the editor\'s text when the save has not failed, even with a bar status', async () => {
    const { wrapper } = mountEdit()
    const open = vi.fn(() => true)
    const unregister = registerBarStatus(cwa, { open })
    const input = await startEditing(wrapper)
    expect(input.attributes('aria-invalid')).toBeUndefined()

    await input.trigger('keydown', { key: 'Escape' })
    await flushPromises()

    expect(open).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(shown(wrapper).element)
    unregister()
  })

  test('registers its model and label, so the bar status can name the field and retry or reset it', () => {
    const { model } = mountEdit()
    const editor = findInlineEditor(cwa, { iri: () => '/component/title', field: 'title' })!

    expect(editor.model).toBe(model)
    expect(editor.label).toBe('Title')
  })

  test('with its save failed and no bar on screen, or a bar that cannot open it, Escape stays on the editor\'s text', async () => {
    const { wrapper } = mountEdit('How we build a kitchen', {}, 'error')
    const unregister = registerBarStatus(cwa, { open: () => false })
    let input = await startEditing(wrapper)
    await input.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(document.activeElement).toBe(shown(wrapper).element)
    unregister()

    input = await startEditing(wrapper)

    await input.trigger('keydown', { key: 'Escape' })
    await flushPromises()

    expect(document.activeElement).toBe(shown(wrapper).element)
  })

  test('Enter that confirms an IME composition does not commit, and the next Enter does', async () => {
    const { wrapper, model } = mountEdit()
    const input = await startEditing(wrapper)
    await input.setValue('台所')

    input.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }))
    await flushPromises()
    expect(model.model.value).toBe('How we build a kitchen')
    expect(wrapper.find('input').exists()).toBe(true)

    await input.trigger('keydown', { key: 'Enter' })
    expect(model.model.value).toBe('台所')
  })

  test('an Escape it did not act on, with the text shown and not editing, still reaches the page, so clone mode and the manager hear it', async () => {
    const { wrapper } = mountEdit()
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    await new Promise(resolve => setTimeout(resolve, 5))

    shown(wrapper).element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(outer).toHaveBeenCalledOnce()
    document.removeEventListener('keydown', outer)
  })

  test('Space on the shown text starts editing, as a button does, without scrolling the page', async () => {
    const { wrapper } = mountEdit()
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })

    shown(wrapper).element.dispatchEvent(space)
    await flushPromises()

    expect(space.defaultPrevented).toBe(true)
    expect(wrapper.find('input').exists()).toBe(true)
  })

  test('leaving the input commits, as long as the text changed, and an emptied value saves null', async () => {
    const { wrapper, model } = mountEdit()
    let input = await startEditing(wrapper)
    await input.trigger('blur')
    expect(model.model.value).toBe('How we build a kitchen')

    input = await startEditing(wrapper)
    await input.setValue('')
    await input.trigger('blur')

    expect(model.model.value).toBeNull()
    expect(wrapper.find('input').exists()).toBe(false)
  })

  test('reports focus to presence from its root', async () => {
    const { wrapper, focusin } = mountEdit()
    await startEditing(wrapper)

    expect(focusin).toHaveBeenCalled()
  })

  test('the bar\'s Edit on page finds it, opens it with the caret at the end, and Escape goes back to the button without saving', async () => {
    const { wrapper, model } = mountEdit()
    const caret = vi.spyOn(HTMLInputElement.prototype, 'setSelectionRange')
    const button = document.createElement('button')
    document.body.append(button)
    const editor = findInlineEditor(cwa, { iri: () => '/component/title', field: 'title' })!

    openInlineEditor(editor, button)
    await flushPromises()
    const input = wrapper.get<HTMLInputElement>('input')
    expect(document.activeElement).toBe(input.element)
    expect(caret).toHaveBeenCalledWith(22, 22)
    await input.setValue('Typed then abandoned')

    await input.trigger('keydown', { key: 'Escape' })
    input.element.dispatchEvent(new FocusEvent('blur'))
    await nextTick()
    expect(document.activeElement).toBe(button)
    expect(model.model.value).toBe('How we build a kitchen')
    caret.mockRestore()
  })

  test('shows a held remote change with Use theirs and Keep mine', () => {
    const remote = { name: 'Alex', value: 'Theirs', accept: vi.fn(), keep: vi.fn() } as unknown as RemoteFieldChange<string>
    const wrapper = mount(InlineEdit, { props: { model: fieldModel('Mine', remote).model, label: 'Title' }, attachTo: document.body })

    expect(wrapper.get('[data-testid="remote-change"]').text()).toContain('Alex changed this')
  })

  test('the value and the input draw the kit focus ring without removing the outline', async () => {
    const { wrapper } = mountEdit()
    expect(drawsFocusRing(shown(wrapper).classes())).toBe(true)
    const input = await startEditing(wrapper)

    expect(drawsFocusRing(input.classes())).toBe(true)
  })

  test('has no axe violations shown or editing', async () => {
    const { wrapper } = mountEdit()
    expect(await axe(document.body)).toHaveNoViolations()
    await startEditing(wrapper)

    expect(await axe(document.body)).toHaveNoViolations()
  })
})

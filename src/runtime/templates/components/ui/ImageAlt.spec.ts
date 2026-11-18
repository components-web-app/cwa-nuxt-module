// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../test/utils/focus-ring'
import ImageAlt from './ImageAlt.vue'
import { formSurfaceKey, managerTabKey } from '../core/ui/field-keys'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'
import ImageSlots from './ImageSlots.vue'
import type { CwaUploadField } from './FileUpload.vue'
import type { ResourceModelField } from '#cwa/resources/model-editors'

vi.mock('#cwa/composables/cwa-resource-upload', () => ({ useCwaResourceUpload: vi.fn() }))
const resourceModel = vi.hoisted(() => ({ fn: vi.fn() }))
vi.mock('#cwa/composables/cwa-resource-model', () => ({ useCwaResourceModel: (...args: unknown[]) => resourceModel.fn(...args) }))

enableAutoUnmount(afterEach)

function fakeUpload(name = 'workshop-bench.jpg', status: CwaFieldState['status'] = 'idle'): CwaUploadField {
  return {
    file: computed(() => ({ name, size: '240 KB', url: `/files/${name}`, mimeType: 'image/jpeg' })),
    state: computed(() => ({ status, waiting: false, slow: false, error: status === 'error' ? { kind: 'server' as const, message: 'The upload failed.' } : undefined })),
    updating: ref(false),
    handleInputChangeFile: vi.fn(async () => {}),
    handleInputDeleteFile: vi.fn(async () => {}),
    retry: vi.fn(async () => {}),
    reset: vi.fn(async () => {}),
  }
}

function altModel(value: string | null): ResourceModelField<string> {
  return { model: ref(value), remoteChange: computed(() => undefined) }
}

function chip(wrapper: { get: (selector: string) => { element: Element } }) {
  return wrapper.get('[data-testid="image-alt-chip"]').element as HTMLButtonElement
}

describe('CwaUiImageAlt (#461)', () => {
  test('shows the image with an Alt chip whose hover text is the alt text', () => {
    const wrapper = mount(ImageAlt, { props: { label: 'Image', upload: fakeUpload(), alt: altModel('A bench in the workshop') }, attachTo: document.body })

    expect(wrapper.get('[data-testid="file-upload"]').text()).toContain('workshop-bench.jpg')
    expect(chip(wrapper).textContent?.trim()).toBe('Alt')
    expect(chip(wrapper).title).toBe('A bench in the workshop')
    expect(chip(wrapper).getAttribute('aria-label')).toBe('Alt text: A bench in the workshop')
    expect(wrapper.find('[data-testid="image-alt-missing"]').exists()).toBe(false)
  })

  test('missing alt text shows a warning dot and says so', () => {
    const wrapper = mount(ImageAlt, { props: { label: 'Image', upload: fakeUpload(), alt: altModel(null) }, attachTo: document.body })

    expect(wrapper.get('[data-testid="image-alt-missing"]').classes()).toContain('cwa:bg-warning')
    expect(chip(wrapper).getAttribute('aria-label')).toBe('Alt text missing')
  })

  test('the chip opens a popover editing the alt text through the same model', async () => {
    const alt = altModel('A bench')
    const wrapper = mount(ImageAlt, { props: { label: 'Image', upload: fakeUpload(), alt }, attachTo: document.body })

    chip(wrapper).click()
    await flushPromises()
    const panel = document.querySelector<HTMLElement>('[data-testid="image-alt-popover"]')!
    expect(panel.getAttribute('aria-label')).toBe('Image alt text')
    const input = panel.querySelector('input')!
    expect(input.value).toBe('A bench')
    input.value = 'A bench by the window'
    input.dispatchEvent(new Event('input'))
    expect(alt.model.value).toBe('A bench by the window')
  })

  test('in the bar an upload error keeps the bar layout: the status line inside the control, no label above and no error line below', () => {
    const wrapper = mount(ImageAlt, { props: { label: 'Image', upload: fakeUpload('bench.jpg', 'error'), alt: altModel('x') }, attachTo: document.body })

    expect(wrapper.find('[data-testid="field-status-line"]').attributes('data-line')).toBe('error')
    expect(wrapper.find('[data-testid="field-error"]').exists()).toBe(false)
  })

  test('the chip sits beside the upload control, outside its status box, so it stays level with it in the bar', () => {
    const wrapper = mount(ImageAlt, { props: { label: 'Image', upload: fakeUpload('bench.jpg', 'error'), alt: altModel('x') }, attachTo: document.body })
    const box = wrapper.get('[data-testid="field-status-line"]').element.parentElement!

    expect(box.contains(chip(wrapper))).toBe(false)
    expect(box.parentElement!.contains(chip(wrapper))).toBe(true)
    expect(box.parentElement!.classList).toContain('cwa:items-center')
  })

  test('in a dialog the upload belongs to the dialog\'s form, and an error line goes below the row holding the control and the chip', () => {
    const register = vi.fn(() => () => {})
    const wrapper = mount(ImageAlt, {
      props: { label: 'Image', field: 'image', upload: fakeUpload('bench.jpg', 'error'), alt: altModel('x') },
      global: { provide: { [formSurfaceKey as symbol]: { unsaved: (field: string) => field === 'image', register } } },
      attachTo: document.body,
    })

    expect(register).toHaveBeenCalledWith('image', 'Image')
    expect(wrapper.find('[data-testid="field-unsaved"]').exists()).toBe(true)
    const row = chip(wrapper).parentElement!
    expect(row.contains(wrapper.get('[data-testid="file-upload"]').element)).toBe(true)
    expect(row.contains(wrapper.get('[data-testid="field-error"]').element)).toBe(false)
    expect(row.classList).toContain('cwa:items-center')
  })

  test('the alt text in the popover is laid out as a form field, label above, even in the bar', async () => {
    const wrapper = mount(ImageAlt, { props: { label: 'Image', upload: fakeUpload(), alt: altModel('A bench') }, attachTo: document.body })

    chip(wrapper).click()
    await flushPromises()
    const panel = document.querySelector<HTMLElement>('[data-testid="image-alt-popover"]')!
    expect(panel.querySelector('.cwa\\:flex-col label')?.textContent).toBe('Alt text')
  })

  test('with altField the chip reads the alt text through the tab\'s model for that field, the one the popover edits', async () => {
    const model = { model: ref<string | null>('A bench by the window'), remoteChange: computed(() => undefined) }
    resourceModel.fn.mockReturnValue(model)
    const iri = ref('/component/image')
    const wrapper = mount(ImageAlt, {
      props: { label: 'Image', upload: fakeUpload(), altField: 'alt' },
      global: { provide: { [managerTabKey as symbol]: { iri, register: vi.fn() } } },
      attachTo: document.body,
    })

    expect(resourceModel.fn).toHaveBeenCalledOnce()
    expect(resourceModel.fn).toHaveBeenCalledWith(iri, 'alt')
    expect(chip(wrapper).getAttribute('aria-label')).toBe('Alt text: A bench by the window')
    chip(wrapper).click()
    await flushPromises()
    expect(resourceModel.fn).toHaveBeenCalledOnce()
    expect(document.querySelector<HTMLInputElement>('[data-testid="image-alt-popover"] input')!.value).toBe('A bench by the window')
    resourceModel.fn.mockReset()
  })

  test('the chip draws the kit focus ring', () => {
    const wrapper = mount(ImageAlt, { props: { label: 'Image', upload: fakeUpload(), alt: altModel('x') }, attachTo: document.body })

    expect(drawsFocusRing([...chip(wrapper).classList])).toBe(true)
  })

  test('has no axe violations', async () => {
    mount(ImageAlt, { props: { label: 'Image', upload: fakeUpload(), alt: altModel(null) }, attachTo: document.body })

    expect(await axe(document.body)).toHaveNoViolations()
  })
})

describe('CwaUiImageSlots (#461)', () => {
  test('one labelled image field per slot, in a group named by its label', () => {
    const wrapper = mount(ImageSlots, {
      props: { label: 'Gallery', slots: [{ label: 'Left', upload: fakeUpload('left.jpg') }, { label: 'Right', upload: fakeUpload('right.jpg') }] },
      attachTo: document.body,
    })

    const group = wrapper.get('[data-testid="image-slots"]')
    expect(group.attributes('role')).toBe('group')
    expect(group.attributes('aria-label')).toBe('Gallery')
    const uploads = wrapper.findAll('[data-testid="file-upload"]')
    expect(uploads.map(upload => upload.text())).toEqual([expect.stringContaining('left.jpg'), expect.stringContaining('right.jpg')])
    expect(wrapper.findAll('[data-testid="image-slots-divider"]')).toHaveLength(1)
  })

  test('has no axe violations', async () => {
    mount(ImageSlots, { props: { label: 'Gallery', slots: [{ label: 'Left', upload: fakeUpload() }, { label: 'Right', upload: fakeUpload() }] }, attachTo: document.body })

    expect(await axe(document.body)).toHaveNoViolations()
  })
})

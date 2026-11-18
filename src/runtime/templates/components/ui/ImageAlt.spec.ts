// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../test/utils/focus-ring'
import ImageAlt from './ImageAlt.vue'
import ImageSlots from './ImageSlots.vue'
import type { CwaUploadField } from './FileUpload.vue'
import type { ResourceModelField } from '#cwa/resources/model-editors'

vi.mock('#cwa/composables/cwa-resource-upload', () => ({ useCwaResourceUpload: vi.fn() }))

enableAutoUnmount(afterEach)

function fakeUpload(name = 'workshop-bench.jpg'): CwaUploadField {
  return {
    file: computed(() => ({ name, size: '240 KB', url: `/files/${name}`, mimeType: 'image/jpeg' })),
    state: computed(() => ({ status: 'idle' as const, waiting: false, slow: false })),
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
  test('the Alt chip sits on the image field\'s row, below the field\'s label, not centred against label and field together (#461)', () => {
    const wrapper = mount(ImageAlt, { props: { label: 'Image', upload: fakeUpload(), alt: altModel(null) } })

    expect(wrapper.classes()).toContain('cwa:items-end')
    expect(wrapper.classes()).not.toContain('cwa:items-center')
  })

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

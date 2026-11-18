// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import FileUpload from './FileUpload.vue'
import type { CwaUploadField } from './FileUpload.vue'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'

vi.mock('#cwa/composables/cwa-resource-upload', () => ({ useCwaResourceUpload: vi.fn() }))

enableAutoUnmount(afterEach)

function fakeUpload(file?: { name: string, size: string, url?: string, mimeType?: string }, status: CwaFieldState['status'] = 'idle') {
  const state = ref<CwaFieldState>({ status, waiting: false, slow: false, error: status === 'error' ? { kind: 'server', message: 'Too large.' } : undefined })
  const upload: CwaUploadField = {
    file: computed(() => file),
    state: computed(() => state.value),
    updating: ref(false),
    handleInputChangeFile: vi.fn(async () => {}),
    handleInputDeleteFile: vi.fn(async () => {}),
    retry: vi.fn(async () => {}),
    reset: vi.fn(async () => {}),
  }
  return upload
}

const bench = { name: 'workshop-bench.jpg', size: '240 KB', url: '/files/workshop-bench.jpg', mimeType: 'image/jpeg' }

describe('CwaUiFileUpload (#460)', () => {
  test('a named group showing the thumbnail, the file name and size, Replace and Remove', () => {
    const wrapper = mount(FileUpload, { props: { label: 'Image', upload: fakeUpload(bench) }, attachTo: document.body })
    const group = wrapper.get('[data-testid="file-upload"]')

    expect(group.attributes('role')).toBe('group')
    expect(document.getElementById(group.attributes('aria-labelledby')!)!.textContent).toBe('Image')
    expect(group.get('img').attributes('src')).toBe('/files/workshop-bench.jpg')
    expect(wrapper.get('[data-testid="file-name"]').text()).toBe('workshop-bench.jpg · 240 KB')
    expect(wrapper.get('[data-testid="file-choose"]').text()).toBe('Replace')
    expect(wrapper.find('[data-testid="file-remove"]').exists()).toBe(true)
  })

  test('with no file it offers Upload and no Remove', () => {
    const wrapper = mount(FileUpload, { props: { label: 'Image', upload: fakeUpload() } })

    expect(wrapper.get('[data-testid="file-name"]').text()).toBe('No file')
    expect(wrapper.get('[data-testid="file-choose"]').text()).toBe('Upload')
    expect(wrapper.find('[data-testid="file-remove"]').exists()).toBe(false)
  })

  test('a picked file is sent, and Remove removes', async () => {
    const upload = fakeUpload(bench)
    const wrapper = mount(FileUpload, { props: { label: 'Image', upload } })
    const picker = wrapper.get('[data-testid="file-picker"]')
    const picked = new File(['x'], 'b.png', { type: 'image/png' })
    Object.defineProperty(picker.element, 'files', { value: [picked], configurable: true })
    await picker.trigger('change')
    await wrapper.get('[data-testid="file-remove"]').trigger('click')

    expect(upload.handleInputChangeFile).toHaveBeenCalledWith(picked)
    expect(upload.handleInputDeleteFile).toHaveBeenCalled()
  })

  test('a failed upload draws the error line under the whole group, and Retry in its popover re-sends', async () => {
    const upload = fakeUpload(bench, 'error')
    const wrapper = mount(FileUpload, { props: { label: 'Image', upload }, attachTo: document.body })

    expect(wrapper.get('[data-testid="field-status-line"]').attributes('data-line')).toBe('error')
    await flushPromises()
    ;(wrapper.get('[data-testid="file-upload"] button').element as HTMLElement).focus()
    await flushPromises()
    document.querySelector<HTMLElement>('[data-testid="field-status-retry"]')!.click()
    await flushPromises()

    expect(upload.retry).toHaveBeenCalled()
  })

  test('has no axe violations with and without a file', async () => {
    const withFile = mount(FileUpload, { props: { label: 'Image', upload: fakeUpload(bench) }, attachTo: document.body })
    expect(await axe(withFile.element as HTMLElement)).toHaveNoViolations()

    const empty = mount(FileUpload, { props: { label: 'Image', upload: fakeUpload() }, attachTo: document.body })
    expect(await axe(empty.element as HTMLElement)).toHaveNoViolations()
  })
})

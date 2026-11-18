import { computed, ref } from 'vue'
import type { CwaUploadField } from '../../../src/runtime/templates/components/ui/FileUpload.vue'
import { liveFieldModel } from './fake-save-server'
import type { FakeSaveServer, LiveFieldModel } from './fake-save-server'

const kitImage = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 4 3%22%3E%3Crect width=%224%22 height=%223%22 fill=%22%23a3866a%22/%3E%3C/svg%3E'

export interface KitFieldSet {
  input: LiveFieldModel<string>
  textarea: LiveFieldModel<string>
  number: LiveFieldModel<number>
  toggle: LiveFieldModel<boolean>
  select: LiveFieldModel<string>
  multi: LiveFieldModel<string[]>
  segmented: LiveFieldModel<string>
  date: LiveFieldModel<string>
  search: LiveFieldModel<string>
  file: LiveFieldModel<string>
  upload: CwaUploadField
}

export type KitPlace = 'page' | 'bar' | 'dialog'

export type KitFieldKey = Exclude<keyof KitFieldSet, 'upload'>

export const kitTheirs: { [K in KitFieldKey]: KitFieldSet[K]['model']['value'] } = {
  input: 'Shaker kitchens | Made to measure',
  textarea: 'Made to measure in our Kent workshop.',
  number: 4,
  toggle: false,
  select: 'default',
  multi: ['wide'],
  segmented: 'right',
  date: '2026-12-02T09:00:00.000Z',
  search: '/component/kit/4',
  file: 'brochure.pdf',
}

export const kitFieldLabels: Record<KitFieldKey, { component: string, label: string }> = {
  input: { component: 'CwaUiInput', label: 'Title' },
  textarea: { component: 'CwaUiTextarea', label: 'Intro' },
  number: { component: 'CwaUiNumber', label: 'Columns' },
  toggle: { component: 'CwaUiToggle', label: 'Show heading' },
  select: { component: 'CwaUiSelect', label: 'Layout' },
  multi: { component: 'CwaUiMultiSelect', label: 'Styles' },
  segmented: { component: 'CwaUiSegmented', label: 'Align' },
  date: { component: 'CwaUiDatePicker', label: 'Publish at' },
  search: { component: 'CwaUiResourceSearch', label: 'Linked component' },
  file: { component: 'CwaUiFileUpload', label: 'Image' },
}

export const kitFieldKeys = Object.keys(kitFieldLabels) as KitFieldKey[]

export function kitFieldSet(server: FakeSaveServer): KitFieldSet {
  const file = liveFieldModel<string>(server, 'file', 'workshop-bench.jpg')
  const updating = ref(false)
  const set = {
    input: liveFieldModel(server, 'input', 'Shaker kitchens | Hand-built'),
    textarea: liveFieldModel(server, 'textarea', 'Hand-built shaker kitchens, made to measure.'),
    number: liveFieldModel(server, 'number', 3),
    toggle: liveFieldModel(server, 'toggle', true),
    select: liveFieldModel(server, 'select', 'split'),
    multi: liveFieldModel<string[]>(server, 'multi', ['padding', 'dark']),
    segmented: liveFieldModel(server, 'segmented', 'left'),
    date: liveFieldModel(server, 'date', '2026-12-01T09:00:00.000Z'),
    search: liveFieldModel(server, 'search', '/component/kit/1'),
    file,
    upload: {
      file: computed(() => {
        const name = file.model.value
        if (!name) {
          return undefined
        }
        const image = !name.endsWith('.pdf')
        return { name, size: image ? '240 KB' : '1.2 MB', url: image ? kitImage : undefined, mimeType: image ? 'image/jpeg' : 'application/pdf' }
      }),
      state: file.state,
      updating,
      handleInputChangeFile: async (chosen: File | undefined) => {
        file.model.value = chosen?.name ?? file.model.value
      },
      handleInputDeleteFile: async () => {
        file.model.value = undefined
      },
      retry: () => file.retry!(),
      reset: () => file.reset!(),
    },
  }
  for (const key of kitFieldKeys) {
    server.theirs[key] = kitTheirs[key]
  }
  return set
}

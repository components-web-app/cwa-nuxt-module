<script setup lang="ts">
import { computed, inject, useId, useTemplateRef } from 'vue'
import Field from '../core/ui/Field.vue'
import CwaUiButton from './Button.vue'
import { IDLE_STATE } from '../core/ui/field-context'
import { managerTabKey, tabMetaOnlyKey } from '../core/ui/field-keys'
import { useCwaResourceUpload } from '#cwa/composables/cwa-resource-upload'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'

export interface CwaUploadField {
  file: { readonly value: { name: string, size: string, url?: string, mimeType?: string } | undefined }
  state: { readonly value: CwaFieldState }
  updating: { readonly value: boolean }
  handleInputChangeFile: (file: File | undefined) => Promise<void>
  handleInputDeleteFile: () => Promise<void>
  retry: () => Promise<void>
  reset: () => Promise<void>
}

const props = withDefaults(defineProps<{
  label: string
  labelHidden?: boolean
  info?: string
  description?: string
  accept?: string
  disabled?: boolean
  field?: string
  upload?: CwaUploadField
}>(), {
  labelHidden: false,
  info: undefined,
  description: undefined,
  accept: undefined,
  disabled: false,
  field: undefined,
  upload: undefined,
})

const tab = inject(managerTabKey, undefined)
const metaOnly = inject(tabMetaOnlyKey, false)
props.field && tab?.register(props.field)
const tabIri = computed(() => tab?.iri.value)
const own = props.field && tab && !metaOnly && !props.upload ? useCwaResourceUpload(tabIri, props.field, props.label) : undefined
const bound = computed<CwaUploadField | undefined>(() => props.upload ?? own)

const id = useId()
const picker = useTemplateRef<HTMLInputElement>('picker')
const state = computed(() => bound.value?.state.value ?? IDLE_STATE)
const file = computed(() => bound.value?.file.value)
const isImage = computed(() => !!file.value?.mimeType?.startsWith('image/') && !!file.value.url)
const inactive = computed(() => props.disabled || !bound.value || !!bound.value.updating.value)

const statusModel = computed<ResourceModelField<string>>(() => ({
  model: { value: file.value?.name },
  remoteChange: { value: undefined },
  retry: () => bound.value?.retry() ?? Promise.resolve(),
  reset: () => bound.value?.reset() ?? Promise.resolve(),
}))

function choose() {
  picker.value?.click()
}

function onPicked(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = input.files?.[0]
  input.value = ''
  picked && bound.value?.handleInputChangeFile(picked)
}

function remove() {
  bound.value?.handleInputDeleteFile()
}
</script>

<template>
  <Field
    :label="label"
    :label-hidden="labelHidden"
    :info="info"
    :description="description"
    :state="state"
    :model="statusModel"
    :control-id="id"
    :name="field"
  >
    <template #default="{ describedBy, busy, labelId }">
      <div
        :id="id"
        role="group"
        :aria-labelledby="labelId"
        :aria-describedby="describedBy"
        :aria-busy="busy ? 'true' : undefined"
        data-testid="file-upload"
        class="cwa:flex cwa:h-control cwa:items-center cwa:gap-2 cwa:pointer-coarse:h-hit"
      >
        <img
          v-if="isImage"
          :src="file!.url"
          alt=""
          class="cwa:size-control cwa:shrink-0 cwa:bg-field cwa:object-cover cwa:pointer-coarse:size-hit"
        >
        <span
          v-else
          aria-hidden="true"
          class="cwa:size-control cwa:shrink-0 cwa:bg-field cwa:pointer-coarse:size-hit"
        />
        <span
          class="cwa:min-w-0 cwa:max-w-48 cwa:truncate cwa:text-control"
          :class="file ? 'cwa:text-fg' : 'cwa:text-fg-muted'"
          data-testid="file-name"
        >{{ file ? `${file.name} · ${file.size}` : 'No file' }}</span>
        <CwaUiButton
          :label="file ? 'Replace' : 'Upload'"
          size="sm"
          :disabled="inactive"
          data-testid="file-choose"
          @click="choose"
        />
        <CwaUiButton
          v-if="file"
          label="Remove"
          size="sm"
          :disabled="inactive"
          data-testid="file-remove"
          @click="remove"
        />
        <input
          ref="picker"
          type="file"
          class="cwa:sr-only"
          tabindex="-1"
          aria-hidden="true"
          :accept="accept"
          data-testid="file-picker"
          @change="onPicked"
        >
      </div>
    </template>
  </Field>
</template>

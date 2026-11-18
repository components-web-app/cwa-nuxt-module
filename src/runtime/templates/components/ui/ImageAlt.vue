<script setup lang="ts">
import { computed, provide } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import CwaUiFileUpload from './FileUpload.vue'
import type { CwaUploadField } from './FileUpload.vue'
import CwaUiInput from './Input.vue'
import { formSurfaceKey } from '../core/ui/field-keys'
import type { ResourceModelField } from '#cwa/resources/model-editors'

const props = withDefaults(defineProps<{
  label: string
  info?: string
  accept?: string
  field?: string
  altField?: string
  upload?: CwaUploadField
  alt?: ResourceModelField<string>
}>(), {
  info: undefined,
  accept: 'image/*',
  field: undefined,
  altField: undefined,
  upload: undefined,
  alt: undefined,
})

const altText = computed(() => props.alt?.model.value ?? '')

provide(formSurfaceKey, { unsaved: () => false, register: () => () => {} })
</script>

<template>
  <span class="cwa:flex cwa:shrink-0 cwa:items-center cwa:gap-2">
    <CwaUiFileUpload
      :label="label"
      :info="info"
      :accept="accept"
      :field="field"
      :upload="upload"
    />
    <PopoverRoot>
      <PopoverTrigger as-child>
        <button
          type="button"
          data-testid="image-alt-chip"
          :title="altText || 'No alt text'"
          :aria-label="altText ? `Alt text: ${altText}` : 'Alt text missing'"
          class="cwa:inline-flex cwa:h-control cwa:shrink-0 cwa:cursor-pointer cwa:items-center cwa:gap-1.5 cwa:bg-field cwa:px-2 cwa:text-control cwa:text-fg cwa:outline-1 cwa:outline-transparent cwa:hover:bg-field-hover cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:pointer-coarse:h-hit"
        >
          Alt
          <span
            v-if="!altText"
            data-testid="image-alt-missing"
            aria-hidden="true"
            class="cwa:size-2 cwa:rounded-toggle cwa:bg-warning"
          />
        </button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          side="top"
          align="start"
          :side-offset="6"
          :collision-padding="8"
          role="dialog"
          :aria-label="`${label} alt text`"
          data-testid="image-alt-popover"
          class="cwa:z-context cwa:w-[min(20rem,calc(100vw-1rem))] cwa:bg-surface-menu cwa:p-3 cwa:text-fg cwa:shadow-popover cwa:outline-1 cwa:outline-transparent"
        >
          <CwaUiInput
            v-if="altField"
            :field="altField"
            label="Alt text"
            description="Who, where, doing what"
            width="full"
          />
          <CwaUiInput
            v-else
            :model="alt"
            label="Alt text"
            description="Who, where, doing what"
            width="full"
          />
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </span>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import CwaUiInput from '../../ui/Input.vue'
import { fieldGroupKey } from './field-keys'
import { isLinkUrl, isOffSiteUrl } from '#cwa/resources/link-url'

const { field, label } = defineProps<{
  field: string
  label: string
}>()

const group = inject(fieldGroupKey, undefined)
const touched = ref(false)
const value = computed(() => group?.model(field)?.model.value)
const invalid = computed(() => touched.value && value.value && !isLinkUrl(value.value) ? 'Use /path or https://…' : undefined)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    touched.value = true
  }
}
</script>

<template>
  <CwaUiInput
    :field="field"
    :label="label"
    label-hidden
    type="url"
    nullable
    placeholder="/path or https://…"
    :invalid="invalid"
    @focusin="touched = false"
    @focusout="touched = true"
    @keydown="onKeydown"
  >
    <template
      v-if="isOffSiteUrl(value)"
      #suffix
    >
      <span
        class="cwa:pr-3 cwa:text-fg-muted"
        role="img"
        aria-label="Opens another site"
        data-testid="link-off-site"
      >↗</span>
    </template>
  </CwaUiInput>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CopyButton from '#cwa/templates/components/core/ui/CopyButton.vue'

defineOptions({ inheritAttrs: false })

const { text, kind = 'id' } = defineProps<{
  text: string
  kind?: 'id' | 'path'
}>()

defineSlots<{
  default?: () => any
}>()

const copy = computed(() => kind === 'path'
  ? { label: `Copy path ${text}`, copied: 'Path copied', failed: 'The path couldn\'t be copied' }
  : { label: `Copy ID ${text}`, copied: 'ID copied', failed: 'The ID couldn\'t be copied' })
</script>

<template>
  <span class="cwa:flex cwa:min-w-0 cwa:items-start cwa:gap-1">
    <slot>
      <span v-bind="$attrs">{{ text }}</span>
    </slot>
    <CopyButton
      :text="text"
      :label="copy.label"
      :copied="copy.copied"
      :failed="copy.failed"
      data-testid="copy-text"
      class="cwa:-my-1.5 cwa:pointer-coarse:-my-3"
    />
  </span>
</template>

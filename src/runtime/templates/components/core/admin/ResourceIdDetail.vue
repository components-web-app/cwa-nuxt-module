<script setup lang="ts">
import CopyButton from '#cwa/templates/components/core/ui/CopyButton.vue'

defineOptions({ inheritAttrs: false })

const { iri } = defineProps<{
  iri?: string
}>()
</script>

<template>
  <dl class="cwa:m-0">
    <dt class="cwa:text-label cwa:text-fg">
      ID
    </dt>
    <dd class="cwa:m-0 cwa:mt-1 cwa:flex cwa:min-w-0 cwa:items-center cwa:gap-1">
      <span
        v-bind="$attrs"
        class="cwa:min-w-0 cwa:break-all cwa:font-mono cwa:text-control cwa:text-fg-secondary"
      >{{ iri }}</span>
      <CopyButton
        v-if="iri"
        :text="iri"
        label="Copy ID"
        copied="ID copied"
        failed="The ID couldn't be copied"
        data-testid="resource-id-copy"
      />
    </dd>
  </dl>
</template>

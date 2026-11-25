<script setup lang="ts">
import EyeIcon from '../../ui/icon/EyeIcon.vue'
import EyeOffIcon from '../../ui/icon/EyeOffIcon.vue'

const { noun, controls, disabled = false } = defineProps<{
  noun: string
  controls: string
  disabled?: boolean
}>()

const revealed = defineModel<boolean>({ required: true })
</script>

<template>
  <button
    type="button"
    :aria-pressed="revealed ? 'true' : 'false'"
    :aria-label="revealed ? `Hide ${noun}` : `Show ${noun}`"
    :aria-controls="controls"
    :disabled="disabled"
    class="cwa:me-1 cwa:inline-flex cwa:size-8 cwa:shrink-0 cwa:items-center cwa:justify-center cwa:self-center cwa:text-fg-muted cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:ease-out cwa:hover:text-fg cwa:motion-reduce:transition-none cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:disabled:cursor-not-allowed cwa:pointer-coarse:min-h-hit cwa:pointer-coarse:min-w-hit"
    @mousedown.prevent
    @click="revealed = !revealed"
  >
    <EyeOffIcon
      v-if="revealed"
      data-testid="icon-eye-off"
      aria-hidden="true"
      class="cwa:size-4"
    />
    <EyeIcon
      v-else
      data-testid="icon-eye"
      aria-hidden="true"
      class="cwa:size-4"
    />
  </button>
</template>

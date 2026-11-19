<script setup lang="ts">
import CwaUiButton from '../../ui/Button.vue'
import CopyGlyph from './CopyGlyph.vue'
import { useAnnounce } from './field-context'

const { text, label, copied, failed } = defineProps<{
  text: string
  label: string
  copied: string
  failed: string
}>()

const announce = useAnnounce()

async function copy() {
  try {
    await navigator.clipboard.writeText(text)
    announce(copied)
  }
  catch {
    announce(failed)
  }
}
</script>

<template>
  <CwaUiButton
    variant="ghost"
    size="sm"
    icon-only
    :icon="CopyGlyph"
    :label="label"
    @click="copy"
  />
</template>

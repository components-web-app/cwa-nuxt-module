<script setup lang="ts">
import { getCurrentInstance, useTemplateRef } from 'vue'
import { useCwaReveal } from './reveal'

const { when, keep = false } = defineProps<{ when: boolean, keep?: boolean }>()

const root = useTemplateRef<HTMLElement>('root')

const instance = getCurrentInstance()
useCwaReveal(() => root.value, () => when, () => (instance?.proxy?.$el as Node | null | undefined)?.parentElement)
</script>

<template>
  <div
    v-if="keep || when"
    v-show="when"
    ref="root"
    class="cwa:contents"
    data-cwa-reveal
  >
    <slot />
  </div>
</template>

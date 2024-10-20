<script lang="ts" setup>
import type { ButtonOption, ModelValue } from './Button.vue'
import ButtonPopoverItem from './ButtonPopoverItem.vue'

const emit = defineEmits<{ (e: 'click', value?: ModelValue): void }>()

defineProps<{
  options: ButtonOption[]
}>()
</script>

<template>
  <div class="[&:not(:last-child)]:cwa-border-b cwa-border-solid cwa-border-stone-400">
    <ButtonPopoverItem
      v-for="(option, index) of options"
      :key="`option-${index}-${option.label}`"
      :option="option"
      @click="(value: ModelValue) => emit('click', value)"
    />
  </div>
</template>

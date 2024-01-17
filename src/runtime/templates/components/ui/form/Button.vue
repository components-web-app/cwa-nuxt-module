<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<
{
  color?: 'blue' | 'grey' | 'dark',
  buttonClass?: string,
  options?: string[]
}>(), {
  color: 'grey',
  buttonClass: undefined,
  options: undefined
})

const emit = defineEmits<{(e: 'click', value?: number): void}>()

const buttonColorClassNames = computed(() => {
  if (props.color === 'blue') {
    return 'cwa-text-white cwa-bg-blue-600/90 hover:cwa-bg-blue-600 cwa-border-transparent'
  }
  if (props.color === 'dark') {
    return 'cwa-text-light cwa-bg-dark/90 hover:cwa-bg-dark cwa-border-stone-400 hover:cwa-border-white hover:cwa-text-white'
  }
  return 'cwa-text-white cwa-bg-stone-700/90 hover:cwa-bg-stone-700 cwa-border-transparent'
})

const buttonClassNames = computed(() => {
  const baseClass = `cwa-py-1.5 cwa-px-2 md:cwa-px-4 cwa-border cwa-transition cwa-flex-grow ${props.buttonClass}`
  return `${baseClass} ${buttonColorClassNames.value}`
})

const hasOptions = computed(() => {
  return props.options?.length
})

const dotClassName = ['cwa-w-[0.3rem]', 'cwa-h-[0.3rem]', 'cwa-rounded-full', 'cwa-bg-white', 'cwa-absolute', 'cwa-left-1/2', '-cwa-translate-x-1/2']

const middleDotClassName = computed(() => {
  return [...dotClassName, 'cwa-top-1/2 -cwa-translate-y-1/2']
})

const topDotClassName = computed(() => {
  return [...dotClassName, 'cwa-top-2']
})

const bottomDotClassName = computed(() => {
  return [...dotClassName, 'cwa-bottom-2']
})

</script>

<template>
  <div class="cwa-flex cwa-space-x-1">
    <button :class="buttonClassNames" @click.prevent.stop="emit('click')">
      <slot />
    </button>
    <button v-if="hasOptions" :class="buttonColorClassNames" class="cwa-px-4 cwa-relative">
      <span :class="topDotClassName" />
      <span :class="middleDotClassName" />
      <span :class="bottomDotClassName" />
    </button>
  </div>
</template>

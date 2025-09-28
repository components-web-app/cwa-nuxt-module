<script lang="ts" setup>
withDefaults(defineProps<{
  tag?: string
  color?: 'text-stone-600' | 'text-black'
}>(), {
  tag: 'h2',
  color: 'text-stone-600',
})
</script>

<template>
  <component
    :is="tag"
    class="text-3xl xs:text-4xl md:text-5xl xl:text-6xl font-bold"
    :class="[color]"
  >
    <slot />
  </component>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { defineNuxtLink, type NuxtLinkProps } from '#app'
import { useCwa } from '#imports'

const props = defineProps<NuxtLinkProps>()

const $cwa = useCwa()
const CwaLinkComponent = defineNuxtLink({
  componentName: 'CwaLink',
})
const cwaLink = CwaLinkComponent.useLink(props)

const target = computed(() => {
  if (props.target) {
    return props.target
  }
  return cwaLink.isExternal.value ? '_blank' : '_self'
})

function handleClick(e: MouseEvent) {
  if (!cwaLink.isExternal.value) {
    return
  }
  $cwa.navigationDisabled && e.preventDefault()
}
</script>

<template>
  <CwaLinkComponent
    v-bind="props"
    :target="target"
    @click="handleClick"
  >
    <slot />
  </CwaLinkComponent>
</template>

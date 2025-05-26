<script lang="ts" setup>
import { defineNuxtLink, type NuxtLinkProps } from '#app'
import { useCwa } from '#imports'

const props = defineProps<NuxtLinkProps>()

const $cwa = useCwa()
const CwaLinkComponent = defineNuxtLink({
  componentName: 'CwaLink',
})
const cwaLink = CwaLinkComponent.useLink(props)

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
    @click="handleClick"
  >
    <slot />
  </CwaLinkComponent>
</template>

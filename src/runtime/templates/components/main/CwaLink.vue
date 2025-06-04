<script lang="ts" setup>
import { computed } from 'vue'
import { hashMode } from '#build/router.options.mjs'
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

function isHashLinkWithoutHashMode(link: NuxtLinkProps['to']) {
  return !hashMode && typeof link === 'string' && link.startsWith('#')
}

function handleClick(e: MouseEvent) {
  if (!cwaLink.isExternal.value && !isHashLinkWithoutHashMode(cwaLink.to.value)) {
    return
  }
  if ($cwa.navigationDisabled) e.preventDefault()
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

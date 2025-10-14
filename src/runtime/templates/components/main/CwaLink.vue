<script lang="ts" setup>
import type { NuxtLinkProps } from 'nuxt/app'
import { computed } from 'vue'
import { hashMode } from '#build/router.options.mjs'
import { useCwa, defineNuxtLink } from '#imports'

defineSlots<{
  default(): any
}>()

// todo: find out why href and rel are not compatible with the defineNuxtLink definition
const props = defineProps<Omit<NuxtLinkProps, 'href' | 'rel'>>()

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

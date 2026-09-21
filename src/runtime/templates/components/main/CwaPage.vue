<template>
  <KeepAlive>
    <ResourceLoader
      v-if="pageIri"
      :key="pageIri"
      :iri="pageIri"
      component-prefix="CwaPage"
    />
  </KeepAlive>
  <CwaPage
    v-if="showAutoChildPage"
    :auto-fallback="true"
  />
</template>

<script setup lang="ts">
import { computed, inject, onMounted, provide, ref } from 'vue'
import ResourceLoader from '../core/ResourceLoader.vue'
import { useCwa } from '#imports'

const props = defineProps<{ autoFallback?: boolean }>()

const $cwa = useCwa()
const depth = inject('cwa-page-depth', 0)
const pageIri = computed(() => $cwa.resources.pageIriAtDepth(depth).value)
const pageDataIri = computed(() => $cwa.resources.pageDataIriAtDepth(depth).value)

const mounted = ref(false)
const childRegistered = ref(false)

const registerWithParent = inject<((d: number) => void) | undefined>('cwa-register-child-page', undefined)
if (!props.autoFallback) {
  registerWithParent?.(depth)
}

provide('cwa-register-child-page', (_childDepth: number) => {
  childRegistered.value = true
})

const depthCount = $cwa.resources.depthCount
const showAutoChildPage = computed(() => mounted.value && depthCount.value > depth + 1 && !childRegistered.value)

onMounted(() => {
  mounted.value = true
})

provide('cwa-page-own-depth', depth)
provide('cwa-page-depth', depth + 1)
provide('cwa-page-data-iri', pageDataIri)
</script>

<template>
  <ListHeading :title="pageDataClassName" />
  <pre>{{ endpoint }}</pre>
</template>

<script setup lang="ts">
import { useRoute } from '#app'
import { computed, ref, watchEffect } from 'vue'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import { useCwa } from '#imports'
import { useDataList } from '#cwa/layer/pages/_cwa/composables/useDataList'

const $cwa = useCwa()
const route = useRoute()

const dataType = computed(() => {
  const typeParam = route.params.type
  return Array.isArray(typeParam) ? typeParam[0] : typeParam
})
const dataTypeClassName = computed(() => {
  if (!dataType.value) {
    return
  }
  return dataType.value.split('\\').pop()
})
const dataTypeCamelCase = computed(() => {
  const className = dataTypeClassName.value
  if (!className) {
    return
  }
  return className.charAt(0).toLowerCase() + className.slice(1)
})
const pageDataClassName = computed(() => {
  if (!dataType.value) {
    return 'Unknown'
  }
  return $cwa.pageDataConfig?.[dataType.value]?.name || dataType.value
})
const endpoint = ref<string>()

// to force the loading of api documentation
useDataList()

watchEffect(async () => {
  const docs = await $cwa.getApiDocumentation()
  if (dataTypeCamelCase.value) {
    endpoint.value = docs?.entrypoint?.[dataTypeCamelCase.value]
  }
})
</script>

<template>
  <div>
    <pre>apiDocumentation : {{ apiDocumentation }}</pre>
    <pre>{{ resourcesStore.$state.current.byId }}</pre>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useNuxtApp } from '#app'
const { $cwa } = useNuxtApp()
const resourcesStore = $cwa.stores.resources.useStore()
const apiDocumentation = ref(null)
$cwa.getApiDocumentation().then((docs) => {
  apiDocumentation.value = docs
})
</script>

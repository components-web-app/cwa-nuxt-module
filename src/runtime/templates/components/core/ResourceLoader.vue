<template>
  <div>
    {{ $cwa.resourcesManager.getResource(props.iri) }}
    <component :is="resolvedComponent" v-if="componentExists" :show="true" />
  </div>
</template>

<script setup>
import { computed, resolveComponent, defineProps } from 'vue'
import { useNuxtApp } from '#app'
const { $cwa } = useNuxtApp()

const props = defineProps({
  iri: {
    type: String,
    required: true
  }
})

const resolvedComponent = computed(() => {
  return resolveComponent('CwaUtilsSpinner')
})

const componentExists = computed(() => {
  return resolvedComponent.value !== 'CwaUtilsSpinner'
})
</script>

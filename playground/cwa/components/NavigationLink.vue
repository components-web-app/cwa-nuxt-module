<template>
  <nuxt-link :to="resource.data.url" exact-active-class="!text-gray-900 underline" class="text-base font-medium text-gray-500 hover:text-gray-900">
    {{ resource.data.label }}
  </nuxt-link>
</template>

<script setup>
import { useCwaComponent } from '#imports'

const props = defineProps({
  iri: {
    type: String,
    required: true
  }
})

const resource = useCwaComponent(props.iri)
</script>

<template>
  <div class="html-content" v-html="resource.data?.html" />
</template>

<script setup>
import { useNuxtApp } from '#app'

const { $cwa } = useNuxtApp()
const props = defineProps({
  iri: {
    type: String,
    required: true
  }
})

const resource = $cwa.resources.getResource(props.iri)
</script>

<style>
.html-content p:not(:last-child) {
  margin-bottom: 1rem
}
</style>

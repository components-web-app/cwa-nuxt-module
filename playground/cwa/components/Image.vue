<template>
  <div>
    Cwa Component for Image {{ props.iri }}
    <CodeBlock>{{ resource }}</CodeBlock>
  </div>
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

const resource = $cwa.resourcesManager.getResource(props.iri)
</script>

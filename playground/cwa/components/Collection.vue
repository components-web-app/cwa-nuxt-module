<template>
  <div>
    Cwa Component for Collection {{ props.iri }}
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

const resource = $cwa.resources.getResource(props.iri)
</script>

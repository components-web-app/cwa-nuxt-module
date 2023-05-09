<template>
  <div>
    Cwa Component for Form {{ props.iri }}
    <CodeBlock>{{ resource }}</CodeBlock>
  </div>
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

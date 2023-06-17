<template>
  <div>
    Cwa Component for Form {{ props.iri }}
    <CodeBlock>{{ resource }}</CodeBlock>
  </div>
</template>

<script setup>
import { useCwaResourceUtils, iri } from '#imports'

const props = defineProps({
  ...iri
})

const resource = useCwaResourceUtils().getResource(props.iri)
</script>

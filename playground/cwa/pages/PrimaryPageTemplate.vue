<template>
  <CwaComponentGroup reference="primary" :location="props.iri" />
</template>

<script setup>
const props = defineProps({
  iri: {
    type: String,
    required: true
  }
})
</script>

<template>
  <div>
    {{ props.iri }}
  </div>
</template>

<script setup>
const props = defineProps({
  iri: {
    type: String,
    required: true
  }
})
</script>

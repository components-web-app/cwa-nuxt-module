<template>
  <div>
    Primary Page Template {{ props }}
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

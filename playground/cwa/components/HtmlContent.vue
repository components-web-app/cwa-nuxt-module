<template>
  <div class="html-content" v-html="resource.data?.html" />
</template>

<script setup>
const props = defineProps({
  iri: {
    type: String,
    required: true
  }
})

const resource = useCwaComponent(props.iri)
</script>

<style>
.html-content p:not(:last-child) {
  margin-bottom: 1rem
}
</style>

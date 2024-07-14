<script setup lang="ts">
import { useCwaResourceManagerTab } from '#imports'

const { exposeMeta, createComputedState } = useCwaResourceManagerTab({
  name: 'Upload'
})

const file = createComputedState<string|undefined>('file')

defineExpose(exposeMeta)
</script>

<template>
  <div>
    <CwaUiFormFile v-model="file" label="Upload Image" />
  </div>
</template>

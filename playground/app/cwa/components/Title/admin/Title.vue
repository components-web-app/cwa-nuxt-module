<template>
  <CwaUiFormLabelWrapper label="Title">
    <CwaUiFormInput :model="titleModel" />
  </CwaUiFormLabelWrapper>
</template>

<script setup lang="ts">
import {
  useCwaResourceManagerTab,
  useCwaResourceModel,
} from '#imports'

const { exposeMeta, iri }
  = useCwaResourceManagerTab({ name: 'Title' })

const titleModel
  = useCwaResourceModel<string>(iri, 'title')

defineExpose(exposeMeta)
</script>

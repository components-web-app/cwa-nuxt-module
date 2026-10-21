<template>
  <CwaUiFormLabelWrapper label="Label">
    <CwaUiFormInput :model="labelModel" />
  </CwaUiFormLabelWrapper>
</template>

<script setup lang="ts">
import {
  useCwaResourceManagerTab,
  useCwaResourceModel,
} from '#imports'

const { exposeMeta, iri }
  = useCwaResourceManagerTab({ name: 'Label' })

const labelModel
  = useCwaResourceModel<string>(iri, 'label')

defineExpose(exposeMeta)
</script>

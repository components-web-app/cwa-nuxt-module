<template>
  <UFormField
    :label="field.vars.value?.label"
    :error="field.displayErrors.value ? field.errors.value[0] : undefined"
    :required="field.vars.value?.required"
  >
    <UTextarea
      v-if="multiline"
      v-model="field.value.value"
      class="w-full"
      @blur="field.onBlur"
      @input="field.onInput"
    />
    <UInput
      v-else
      v-model="field.value.value"
      class="w-full"
      @blur="field.onBlur"
      @input="field.onInput"
    />
  </UFormField>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useCwaFormInput } from '#imports'

const props = defineProps<{ iri: string, fullName: string, multiline: boolean }>()

const field = useCwaFormInput(toRef(props, 'iri'), props.fullName)
</script>

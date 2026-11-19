<template>
  <div>
    <label :for="field.vars.value?.id">{{ field.vars.value?.label }}</label>
    <textarea
      v-if="multiline"
      :id="field.vars.value?.id"
      v-model="field.value.value"
      :required="field.vars.value?.required"
      @blur="field.onBlur"
      @input="field.onInput"
    />
    <input
      v-else
      :id="field.vars.value?.id"
      v-model="field.value.value"
      :type="email ? 'email' : 'text'"
      :required="field.vars.value?.required"
      @blur="field.onBlur"
      @input="field.onInput"
    >
    <p
      v-if="field.displayErrors.value && field.errors.value[0]"
      role="alert"
    >
      {{ field.errors.value[0] }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useCwaFormInput } from '#cwa/composables/cwa-form-input'

const { iri, fullName, multiline, email } = defineProps<{ iri: string, fullName: string, multiline: boolean, email: boolean }>()

const field = useCwaFormInput(toRef(() => iri), fullName)
</script>

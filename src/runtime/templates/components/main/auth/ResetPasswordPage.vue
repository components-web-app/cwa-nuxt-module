<template>
  <AuthTemplate
    :error="inputErrors?.form || error"
    :submitting="submitting"
    :submit-button-text="success ? 'Go to Login' : 'Reset Password'"
    @submit="resetPassword"
  >
    <div v-if="success">
      <h1 class="cwa-font-bold cwa-text-xl cwa-mb-2">
        Password Reset
      </h1>
      <p>You have successfully reset your password.</p>
    </div>
    <template v-else>
      <InputField
        v-model="passwords.first"
        label="Enter new password"
        name="firstPassword"
        type="password"
        autocomplete="new-password"
        :errors="inputErrors?.password"
        :required="true"
      />
      <InputField
        v-model="passwords.second"
        label="Repeat new password"
        name="secondPassword"
        type="password"
        autocomplete="new-password"
        :required="true"
      />
    </template>
  </AuthTemplate>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AuthTemplate from './_parts/AuthTemplate.vue'
import InputField from './_parts/InputField.vue'

const props = defineProps<{
  submitting: boolean
  modelValue: {
    first: string
    second: string
  }
  error?: string
  inputErrors?: {
    form?: string[]
    password?: string[]
  }
  success: boolean
}>()

const passwords = computed({
  get() {
    return props.modelValue
  },
  set(newValue) {
    emit('update:modelValue', newValue)
  },
})
</script>

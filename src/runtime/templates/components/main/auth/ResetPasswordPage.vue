<template>
  <AuthTemplate
    title="Choose a new password"
    :error="inputErrors?.form || error"
    :field-errors="passwordError ? `Enter new password: ${passwordError}` : undefined"
    :success="success ? 'Password reset' : undefined"
    :submitting="submitting"
    :submit-button-text="success ? 'Go to login' : 'Reset password'"
    @submit="emitSubmit"
  >
    <template #success>
      <p class="cwa:m-0">
        You have successfully reset your password.
      </p>
    </template>
    <template v-if="!success">
      <CwaUiInput
        v-model="passwords.first"
        label="Enter new password"
        name="firstPassword"
        type="password"
        revealable
        autocomplete="new-password"
        :invalid="passwordError"
        required
      />
      <CwaUiInput
        v-model="passwords.second"
        label="Repeat new password"
        name="secondPassword"
        type="password"
        revealable
        autocomplete="new-password"
        required
      />
    </template>
  </AuthTemplate>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AuthTemplate from './_parts/AuthTemplate.vue'
import CwaUiInput from '../../ui/Input.vue'

const props = defineProps<{
  submitting: boolean
  modelValue: {
    first: string
    second: string
  }
  error: string | null
  inputErrors?: {
    form?: string[]
    password?: string[]
  }
  success: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: typeof props.modelValue]
  'submit': []
}>()

function emitSubmit() {
  emit('submit')
}

const passwordError = computed(() => props.inputErrors?.password?.join(' ') || undefined)

const passwords = computed({
  get() {
    return props.modelValue
  },
  set(newValue) {
    emit('update:modelValue', newValue)
  },
})
</script>

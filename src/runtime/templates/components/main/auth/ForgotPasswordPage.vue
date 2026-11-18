<template>
  <AuthTemplate
    title="Reset your password"
    :error="error"
    :success="success ? 'Please check your inbox' : undefined"
    :submitting="submitting"
    :submit-button-text="success ? 'Back to Login' : 'Reset Password'"
    @submit="$emit('submit')"
  >
    <template #success>
      <p class="cwa:m-0">
        If this user exists, we've sent an email with a link to reset your password.
      </p>
    </template>
    <template v-if="!success">
      <CwaUiInput
        v-model="credentials.username"
        label="Username or Email"
        name="username"
        autocomplete="username"
        required
      />
      <div class="cwa:flex cwa:items-center cwa:justify-between">
        <slot>
          <AuthPageLink
            link-to="/login"
            link-text="< Back to login"
          />
        </slot>
      </div>
    </template>
  </AuthTemplate>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AuthTemplate from './_parts/AuthTemplate.vue'
import AuthPageLink from './_parts/AuthPageLink.vue'
import CwaUiInput from '../../ui/Input.vue'

const props = defineProps<{
  submitting: boolean
  modelValue: {
    username: string
  }
  error?: string
  success: boolean
}>()

const emit = defineEmits(['submit', 'update:modelValue'])

const credentials = computed({
  get() {
    return props.modelValue
  },
  set(newValue) {
    emit('update:modelValue', newValue)
  },
})

defineSlots<{
  default(): any
}>()
</script>

<template>
  <AuthTemplate
    :error="error"
    :submitting="submitting"
    :submit-button-text="success ? 'Back to Login' : 'Reset Password'"
    @submit="$emit('submit')"
  >
    <div v-if="success">
      <h1 class="cwa:font-bold cwa:text-xl cwa:mb-2">
        Please check your inbox
      </h1>
      <p>We've sent you an email with a link to reset your password</p>
    </div>
    <template v-else>
      <InputField
        v-model="credentials.username"
        label="Username or Email"
        name="username"
        type="text"
        autocomplete="username"
        :required="true"
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
import InputField from './_parts/InputField.vue'
import AuthPageLink from './_parts/AuthPageLink.vue'

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
</script>

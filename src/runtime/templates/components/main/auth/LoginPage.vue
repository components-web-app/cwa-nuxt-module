<template>
  <AuthTemplate
    :title="title"
    :submitting="submitting"
    :submit-button-text="submitButtonText"
    :error="error"
    @submit="$emit('submit')"
  >
    <slot name="header" />
    <CwaUiInput
      v-model="credentials.username"
      label="Username or Email"
      name="username"
      autocomplete="username"
      required
    />
    <CwaUiInput
      v-model="credentials.password"
      label="Password"
      name="password"
      type="password"
      autocomplete="current-password"
      required
    />
    <slot name="footer">
      <div class="cwa:flex cwa:flex-wrap cwa:items-center cwa:justify-between cwa:gap-x-4 cwa:gap-y-2">
        <AuthPageLink
          link-to="/"
          link-text="< Back to home"
        />
        <AuthPageLink
          link-to="/forgot-password"
          link-text="Forgot your password?"
        />
      </div>
    </slot>
  </AuthTemplate>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AuthTemplate from './_parts/AuthTemplate.vue'
import AuthPageLink from './_parts/AuthPageLink.vue'
import CwaUiInput from '../../ui/Input.vue'

const emit = defineEmits(['submit', 'update:modelValue'])

const props = withDefaults(defineProps<{
  title?: string
  submitButtonText: string
  submitting: boolean
  modelValue: {
    username: string
    password: string
  }
  error?: string
}>(), {
  title: 'Sign in',
  error: undefined,
})

defineSlots<{
  header(): any
  footer(): any
}>()

const credentials = computed({
  get() {
    return props.modelValue
  },
  set(newValue) {
    emit('update:modelValue', newValue)
  },
})
</script>

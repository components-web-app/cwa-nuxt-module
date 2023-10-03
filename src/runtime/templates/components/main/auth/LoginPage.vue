<template>
  <AuthTemplate
    :submitting="submitting"
    :submit-button-text="submitButtonText"
    :error="error"
    @submit="$emit('submit')"
  >
    <template v-if="credentials">
      <InputField
        v-model="credentials.username"
        label="Username or Email"
        name="username"
        type="text"
        autocomplete="username"
        :required="true"
      />
      <InputField
        v-model="credentials.password"
        label="Password"
        name="password"
        type="password"
        autocomplete="current-password"
        :required="true"
      />
    </template>
    <slot>
      <div class="cwa-flex cwa-items-center cwa-justify-between">
        <AuthPageLink link-to="/" link-text="< Back to home" />
        <AuthPageLink link-to="/forgot-password" link-text="Forgot your password?" />
      </div>
    </slot>
  </AuthTemplate>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import AuthTemplate from './_parts/AuthTemplate.vue'
import InputField from './_parts/InputField.vue'

const emit = defineEmits(['submit', 'update:modelValue'])

const props = defineProps<{
  submitButtonText: string,
  submitting: boolean,
  modelValue: {
    username: string,
    password: string
  }
  error?: string
}>()

const AuthPageLink = defineAsyncComponent(() =>
  import('./_parts/AuthPageLink.vue')
)

const credentials = computed({
  get () {
    return props.modelValue
  },
  set (newValue) {
    emit('update:modelValue', newValue)
  }
})
</script>

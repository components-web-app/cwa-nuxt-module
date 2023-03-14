<template>
  <div class="cwa-flex cwa-min-h-full cwa-flex-col cwa-justify-center cwa-py-12 sm:cwa-px-6 lg:cwa-px-8">
    <div class="sm:cwa-mx-auto sm:cwa-w-full sm:cwa-max-w-md">
      <CwaLogo class="cwa-mx-auto cwa-h-12 cwa-w-auto cwa-text-neutral-400" />
    </div>

    <div class="cwa-mt-8 sm:cwa-mx-auto sm:cwa-w-full sm:cwa-max-w-md cwa-text-white">
      <div class="cwa-bg-neutral-800 cwa-py-8 cwa-px-4 cwa-shadow sm:cwa-rounded-lg sm:cwa-px-10">
        <CwaUtilsAlertWarning v-if="error" class="cwa-mb-4">
          {{ error }}
        </CwaUtilsAlertWarning>
        <form action="#" class="cwa-space-y-6" @submit.prevent="signIn">
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
          <div class="cwa-flex cwa-items-center cwa-justify-between">
            <div class="cwa-text-sm">
              <a href="#" class="cwa-font-medium cwa-text-neutral-400 hover:cwa-text-neutral-200">Forgot your password?</a>
            </div>
          </div>
          <div>
            <button
              type="submit"
              :disabled="submitting"
              :class="{ 'cwa-opacity-50': submitting }"
              class="cwa-flex cwa-w-full cwa-justify-center cwa-rounded-md cwa-bg-neutral-600 cwa-py-2 cwa-px-3 cwa-text-sm cwa-font-semibold cwa-text-white cwa-shadow-sm hover:cwa-bg-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-600"
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { navigateTo, useHead, useNuxtApp } from '#app'
import { reactive, ref } from 'vue'
import { FetchError } from 'ofetch'
import InputField from './components/core/login/InputField.vue'

const { $cwa } = useNuxtApp()

useHead({
  bodyAttrs: {
    class: 'cwa-h-full'
  },
  htmlAttrs: {
    class: 'cwa-h-full cwa-bg-neutral-900'
  }
})

const credentials = reactive({
  username: '',
  password: ''
})

const error = ref(null)
const submitting = ref(false)

async function signIn () {
  submitting.value = true
  error.value = null
  const user = await $cwa.auth.signIn(credentials)
  if (user instanceof FetchError) {
    error.value = user.data?.message || user.statusMessage
  } else {
    navigateTo('/')
  }
  submitting.value = false
}
</script>

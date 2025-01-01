<script setup lang="ts">
import { type NuxtError, useHead, useRoute } from '#app'
import { useCwa } from '#cwa/runtime/composables/cwa'

defineProps<{
  error: NuxtError
}>()

const $route = useRoute()
const $cwa = useCwa()

useHead({
  bodyAttrs: {
    class: 'cwa-h-full',
  },
  htmlAttrs: {
    class: 'cwa-h-full',
  },
})
</script>

<template>
  <main class="cwa-h-full cwa-flex cwa-flex-col cwa-bg-white cwa-p-6 lg:cwa-p-8">
    <div class="cwa-flex cwa-justify-center cwa-grow cwa-h-full cwa-items-center">
      <div class="cwa-text-center">
        <p class="cwa-text-base cwa-font-semibold cwa-text-blue-600">
          {{ error.statusCode }}
        </p>
        <h1 class="cwa-mt-4 text-balance cwa-text-4xl cwa-font-semibold cwa-tracking-tight cwa-text-gray-900 sm:cwa-text-6xl">
          {{ error.statusCode === 404 ? 'Page Not Found' : error.statusMessage }}
        </h1>
        <p class="cwa-mt-6 text-pretty cwa-text-lg cwa-font-medium cwa-text-stone-400 sm:text-xl/8">
          {{ error.message }}
        </p>
        <div class="cwa-mt-10 cwa-flex cwa-items-center cwa-justify-center cwa-gap-x-6">
          <NuxtLink
            v-if="$route.path !== '/'"
            to="/"
            class="cwa-rounded-md cwa-bg-blue-600 cwa-px-3.5 cwa-py-2.5 cwa-text-sm cwa-font-semibold cwa-text-white cwa-shadow-sm hover:cwa-bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >Go back home</NuxtLink>
        </div>
      </div>
    </div>
    <div class="cwa-justify-center cwa-space-y-2 cwa-flex cwa-h-auto cwa-grow-0 cwa-flex-col cwa-text-center">
      <div class="cwa-justify-center cwa-flex">
        <CwaLogo class="cwa-h-6 cwa-w-auto cwa-text-stone-300" />
      </div>
      <div class="cwa-text-sm cwa-text-stone-400">
        Are you the owner of this website?
        <NuxtLink
          v-if="$cwa.auth.hasRole('ROLE_ADMIN')"
          to="/_cwa/layouts"
          class="cwa-font-semibold hover:cwa-text-dark"
        >Go to admin <span aria-hidden="true">&rarr;</span></NuxtLink>
        <NuxtLink
          v-else
          to="/login"
          class="cwa-font-semibold hover:cwa-text-dark"
        >Sign in <span aria-hidden="true">&rarr;</span></NuxtLink>
      </div>
    </div>
  </main>
</template>

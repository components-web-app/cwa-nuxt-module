<script setup lang="ts">
import { type NuxtError, useHead, useRoute } from '#app'
import { useCwa } from '#cwa/runtime/composables/cwa'

const props = defineProps<{
  error: NuxtError
}>()
// Deliberately prevent reactive update when error is cleared
const _error = props.error

// TODO: extract to a separate utility
const stacktrace = _error.stack
  ? _error.stack
      .split('\n')
      .splice(1)
      .map((line) => {
        const text = line
          .replace('webpack:/', '')
          .replace('.vue', '.js') // TODO: Support sourcemap
          .trim()
        return {
          text,
          internal: (line.includes('node_modules') && !line.includes('.cache'))
            || line.includes('internal')
            || line.includes('new Promise'),
        }
      }).map(i => `<span class="stack${i.internal ? ' internal' : ''}">${i.text}</span>`).join('\n')
  : ''

const $route = useRoute()
const $cwa = useCwa()

const statusCode = Number(_error.statusCode || 500)
const is404 = statusCode === 404
const statusMessage = _error.statusMessage ?? (is404 ? 'Page Not Found' : 'Internal Server Error')
const description = _error.message || _error.toString()
const stack = import.meta.dev && !is404 ? description || `${stacktrace}` : undefined
useHead({
  bodyAttrs: {
    class: 'cwa:h-full cwa:bg-white cwa:dark:bg-black',
  },
  htmlAttrs: {
    class: 'cwa:h-full',
  },
})
</script>

<template>
  <div class="cwa:h-full cwa:relative cwa:z-10">
    <CwaUiBackgroundParticles class="cwa:absolute cwa:inset-0 cwa:-z-10 cwa:opacity-30 cwa:invert cwa:dark:invert-0" />
    <main class="cwa:h-full cwa:flex cwa:flex-col cwa:p-6 cwa:lg:p-8">
      <div class="cwa:flex cwa:justify-center cwa:grow cwa:h-full cwa:items-center">
        <div class="cwa:text-center">
          <p class="cwa:text-base cwa:font-semibold cwa:text-blue-600">
            {{ statusCode }}
          </p>
          <h1 class="cwa:mt-4 cwa:text-balance cwa:text-4xl cwa:font-semibold cwa:tracking-tight cwa:text-gray-900 cwa:dark:text-stone-100 cwa:sm:text-6xl">
            {{ statusMessage }}
          </h1>
          <p class="cwa:mt-6 cwa:text-pretty cwa:text-lg cwa:font-medium cwa:text-stone-400 sm:text-xl/8">
            {{ description }}
          </p>
          <div
            v-if="stack"
            class="cwa:text-left cwa:bg-black/5 cwa:bg-white cwa:dark:bg-white/10 cwa:flex-1 cwa:h-auto cwa:overflow-y-auto cwa:rounded-md cwa:text-stone-400 cwa:mt-8"
          >
            <pre
              class="cwa:font-light cwa:leading-tight cwa:p-4 cwa:text-sm cwa:z-10"
              v-html="stack"
            />
          </div>
          <div class="cwa:mt-10 cwa:flex cwa:items-center cwa:justify-center cwa:gap-x-6">
            <NuxtLink
              v-if="$route.path !== '/'"
              to="/"
              class="cwa:rounded-md cwa:bg-blue-600 cwa:px-3.5 cwa:py-2.5 cwa:text-sm cwa:font-semibold cwa:text-white cwa:shadow-sm cwa:hover:bg-indigo-500 cwa:focus-visible:outline cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-indigo-600"
            >Go back home</NuxtLink>
          </div>
        </div>
      </div>
      <div class="cwa:justify-center cwa:gap-y-2 cwa:flex cwa:h-auto cwa:grow-0 cwa:flex-col cwa:text-center cwa:pb-2 cwa:pt-6">
        <div class="cwa:justify-center cwa:flex">
          <CwaLogo class="cwa:h-6 cwa:w-auto cwa:text-stone-300" />
        </div>
        <ClientOnly>
          <div class="cwa:text-sm cwa:text-stone-400">
            Are you the owner of this website?
            <NuxtLink
              v-if="$cwa.auth.hasRole('ROLE_ADMIN')"
              to="/_cwa/layouts"
              class="cwa:font-semibold cwa:hover:text-dark cwa:dark:hover:text-white"
            >Go to admin <span aria-hidden="true">&rarr;</span></NuxtLink>
            <NuxtLink
              v-else
              to="/login"
              class="cwa:font-semibold cwa:hover:text-dark cwa:dark:hover:text-white"
            >Sign in <span aria-hidden="true">&rarr;</span></NuxtLink>
          </div>
        </ClientOnly>
      </div>
    </main>
  </div>
</template>

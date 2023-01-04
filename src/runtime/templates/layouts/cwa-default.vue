<template>
  <div>
    <div class="cwa-px-4">
      <div class="cwa-w-full cwa-h-2.5 cwa-bg-gray-200 cwa-rounded-full dark:cwa-bg-gray-700 cwa-my-1">
        <div
          class="cwa-h-2.5 cwa-text-xs cwa-rounded-full cwa-transition-all"
          :class="[ $cwa.resourcesManager.resourceLoadStatus.percent === 100 ? 'cwa-bg-lime-600' : 'cwa-bg-blue-600' ]"
          :style="{ width: $cwa.resourcesManager.resourceLoadStatus.percent + '%' }"
        />
      </div>
      <nuxt-link to="/" exact-active-class="cwa-font-bold">
        Home
      </nuxt-link> |
      <nuxt-link to="/introduction" exact-active-class="cwa-font-bold">
        Introduction
      </nuxt-link> |
      <nuxt-link to="/new" exact-active-class="cwa-font-bold">
        New
      </nuxt-link>
    </div>
    <hr>
    <div>
      <nuxt-page />
    </div>
  </div>
</template>

<script setup>
import { useNuxtApp } from '#app'
const { $cwa } = useNuxtApp()
</script>

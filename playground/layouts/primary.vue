<template>
  <div>
    <CwaUtilsProgressBar :show="$cwa.resourcesManager.pageLoadProgress.value.percent < 100" :percent="$cwa.resourcesManager.pageLoadProgress.value.percent || 3" class="page-progress-bar" />
    <CwaUtilsSpinner :show="$cwa.resourcesManager.isLoading.value === true" class="page-spinner" />
    <header>
      <Popover class="relative bg-white">
        <div class="mx-auto flex max-w-7xl items-center p-6 justify-start space-x-10 lg:px-8">
          <PopoverGroup as="nav" class="space-x-5 flex">
            <nuxt-link to="/" exact-active-class="!text-gray-900 underline" class="text-base font-medium text-gray-500 hover:text-gray-900">
              Home
            </nuxt-link>
            <nuxt-link to="/blog-articles" exact-active-class="!text-gray-900 underline" class="text-base font-medium text-gray-500 hover:text-gray-900">
              Blog
            </nuxt-link>
            <nuxt-link to="/form" exact-active-class="!text-gray-900 underline" class="text-base font-medium text-gray-500 hover:text-gray-900">
              Form
            </nuxt-link>
            <nuxt-link to="/home" exact-active-class="!text-gray-900 underline" class="text-base font-medium text-gray-500 hover:text-gray-900">
              Home Redirect
            </nuxt-link>
          </PopoverGroup>
        </div>
      </Popover>
    </header>
    <div>
      <slot />
    </div>
  </div>
</template>

<script setup>
import { useNuxtApp } from '#app'
import { Popover, PopoverGroup } from '@headlessui/vue'

const { $cwa } = useNuxtApp()
</script>

<style>
.page-spinner {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
}
.page-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1000;
}
</style>

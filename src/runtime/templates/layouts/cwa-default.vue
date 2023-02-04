<template>
  <div>
    <CwaDefaultSpinner :show="$cwa.resourcesManager.isLoading.value === true" class="page-spinner" />
    <header>
      <Popover class="cwa-relative cwa-bg-white">
        <div class="cwa-mx-auto cwa-flex cwa-max-w-7xl cwa-items-center cwa-p-6 cwa-justify-start cwa-space-x-10 lg:cwa-px-8">
          <PopoverGroup as="nav" class="cwa-space-x-5 cwa-flex">
            <nuxt-link to="/" exact-active-class="!cwa-text-gray-900 cwa-underline" class="cwa-text-base cwa-font-medium cwa-text-gray-500 hover:cwa-text-gray-900">
              Home
            </nuxt-link>
            <nuxt-link to="/blog-articles" exact-active-class="!cwa-text-gray-900 cwa-underline" class="cwa-text-base cwa-font-medium cwa-text-gray-500 hover:cwa-text-gray-900">
              Blog
            </nuxt-link>
            <nuxt-link to="/form" exact-active-class="!cwa-text-gray-900 cwa-underline" class="cwa-text-base cwa-font-medium cwa-text-gray-500 hover:cwa-text-gray-900">
              Form
            </nuxt-link>
            <nuxt-link to="/home" exact-active-class="!cwa-text-gray-900 cwa-underline" class="cwa-text-base cwa-font-medium cwa-text-gray-500 hover:cwa-text-gray-900">
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
</style>

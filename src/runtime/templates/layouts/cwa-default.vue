<template>
  <div>
    <div class="cwa-px-4">
      <div class="cwa-w-full cwa-h-2.5 cwa-bg-gray-400 cwa-rounded-full cwa-my-1">
        <div
          class="cwa-h-2.5 cwa-text-xs cwa-rounded-full cwa-transition-all"
          :class="[ $cwa.resourcesManager.resourceLoadStatus.percent === 100 ? 'cwa-bg-lime-600' : 'cwa-bg-blue-600' ]"
          :style="{ width: $cwa.resourcesManager.resourceLoadStatus.percent + '%' }"
        />
      </div>
    </div>
    <header>
      <Popover class="cwa-relative cwa-bg-white">
        <div class="cwa-mx-auto cwa-flex cwa-max-w-7xl cwa-items-center cwa-p-6 cwa-justify-start cwa-space-x-10 lg:cwa-px-8">
          <div class="cwa-flex cwa-justify-start cwa-w-0 cwa-flex-1">
            <a href="#">
              <span class="cwa-sr-only">Your Company</span>
              <img class="cwa-h-8 cwa-w-auto sm:cwa-h-10" src="https://tailwindui.com/img/logos/mark.svg?from-color=purple&from-shade=600&to-color=indigo&to-shade=600&toShade=600" alt="">
            </a>
          </div>
          <PopoverGroup as="nav" class="cwa-space-x-5 cwa-flex">
            <nuxt-link to="/" exact-active-class="!cwa-text-gray-900" class="cwa-text-base cwa-font-medium cwa-text-gray-500 hover:cwa-text-gray-900">
              Home
            </nuxt-link>
            <nuxt-link to="/blog-articles" exact-active-class="!cwa-text-gray-900" class="cwa-text-base cwa-font-medium cwa-text-gray-500 hover:cwa-text-gray-900">
              Blog
            </nuxt-link>
            <nuxt-link to="/form" exact-active-class="!cwa-text-gray-900" class="cwa-text-base cwa-font-medium cwa-text-gray-500 hover:cwa-text-gray-900">
              Form
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
import { Popover, PopoverButton, PopoverGroup } from '@headlessui/vue'
import { Bars3Icon } from '@heroicons/vue/24/outline'
const { $cwa } = useNuxtApp()
</script>

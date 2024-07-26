<template>
  <div class="cwa-flex cwa-relative cwa-h-full cwa-items-center cwa-z-50">
    <CwaUiHamburger v-model="showMenu" class="cwa-relative cwa-z-20" />
    <Transition
      enter-from-class="cwa-transform cwa-opacity-0 cwa-scale-[0.97]"
      enter-active-class="cwa-duration-200 cwa-ease-out"
      enter-to-class="cwa-opacity-100"
      leave-from-class="cwa-opacity-100"
      leave-active-class="cwa-duration-200 cwa-ease-in"
      leave-to-class="cwa-transform cwa-opacity-0 cwa-scale-[0.97]"
    >
      <div v-show="showMenu" class="cwa-absolute cwa-z-10 -cwa-top-1.5 -cwa-right-2 cwa-bg-dark cwa-py-6 cwa-px-12 cwa-w-[90vw] cwa-max-w-xl cwa-origin-top-right">
        <div class="cwa-text-light cwa-flex cwa-flex-col cwa-text-center cwa-space-y-2">
          <div class="cwa-flex cwa-justify-center cwa-opacity-[.35]">
            <CwaLogo class="cwa-h-8 cwa-w-auto" />
          </div>
          <h2 class="cwa-opacity-50 cwa-text-sm cwa-font-bold">
            {{ $cwa.appName }}
          </h2>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CwaLogo from '#cwa/runtime/templates/components/core/assets/CwaLogo.vue'
import { useCwa } from '#imports'

const $cwa = useCwa()
const showMenu = ref(false)
</script>

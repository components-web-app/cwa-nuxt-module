<template>
  <li class="cwa-pointer-events-auto cwa-w-full cwa-max-w-sm cwa-overflow-hidden cwa-rounded-lg cwa-dark-blur cwa-ring-2 cwa-ring-magenta">
    <div class="cwa-p-4">
      <div class="cwa-flex cwa-items-start">
        <div class="cwa-ml-3 cwa-w-0 cwa-flex-1 cwa-pt-0.5">
          <slot />
        </div>
        <div class="cwa-ml-4 cwa-flex cwa-flex-shrink-0">
          <button type="button" @click="$emit('clear')" class="cwa-inline-flex cwa-rounded-md cwa-text-stone-400 hover:cwa-text-white cwa-transition">
            <span class="cwa-sr-only">Close</span>
            <XMarkIcon class="cwa-h-5 cwa-w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </li>
</template>

<script setup>
import { XMarkIcon } from '@heroicons/vue/20/solid'

defineEmits(['clear'])
</script>

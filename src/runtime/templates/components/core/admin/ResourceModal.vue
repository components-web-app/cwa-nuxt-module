<template>
  <div class="cwa-text-light cwa-w-full cwa-bg-stone-800 cwa-max-w-4xl cwa-max-h-full cwa-min-h-96 cwa-flex cwa-flex-col">
    <div class="cwa-bg-stone-900/40 cwa-border-b-2 cwa-border-b-stone-700">
      <div class="cwa-p-3 cwa-flex cwa-justify-end cwa-text-stone-400">
        <button @click="closeModal">
          <CwaUiIconXMarkIcon class="cwa-h-10" />
        </button>
      </div>
      <div class="cwa-p-4 cwa-flex cwa-justify-center">
        <div class="cwa-w-full cwa-max-w-xl cwa-flex cwa-items-center cwa-space-x-2">
          <div class="cwa-max-w-[calc(100%-1.3em)]">
            <input v-if="isEditingTitle" v-model="titleModel" v-auto-width="{ comfortZone: '.5rem' }" class="cwa-dark-blur cwa-text-4xl cwa-py-1 cwa-px-2 cwa-max-w-full -cwa-ml-2">
            <h2 v-else class="cwa-text-4xl cwa-truncate cwa-py-1 cwa-pr-3 cwa-border cwa-border-transparent">
              {{ titleModel }}
            </h2>
          </div>
          <div class="cwa-flex-shrink-0 cwa-w-[1.3em] cwa-cursor-pointer">
            <CwaUiIconTickIcon v-if="isEditingTitle" class="cwa-w-full" @click="isEditingTitle = false" />
            <CwaUiIconPenIcon v-else class="cwa-w-full" @click="isEditingTitle = true" />
          </div>
        </div>
      </div>
    </div>
    <div class="cwa-grow cwa-px-4 cwa-py-6 cwa-flex cwa-justify-center">
      <div class="cwa-w-full cwa-max-w-xl cwa-overflow-auto cwa-max-h-full">
        <slot />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'

import { directive as vAutoWidth } from 'vue-input-autowidth'

// eslint-disable-next-line vue/require-prop-types
const titleModel = defineModel()
const emit = defineEmits(['close'])

const isEditingTitle = ref(false)

function closeModal () {
  emit('close')
}
</script>

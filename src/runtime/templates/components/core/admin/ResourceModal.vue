<template>
  <div class="cwa-text-light cwa-w-full cwa-bg-stone-800 cwa-max-w-4xl cwa-max-h-full cwa-min-h-96 cwa-flex cwa-flex-col">
    <template v-if="isLoading">
      <Spinner class="cwa-absolute cwa-top-1/2 cwa-left-1/2 -cwa-translate-x-1/2  -cwa-translate-y-1/2" :show="true" />
    </template>
    <template v-else>
      <div class="cwa-relative cwa-bg-stone-900/40 cwa-border-b-2 cwa-border-b-stone-700">
        <div class="cwa-p-3 cwa-flex cwa-justify-end cwa-text-stone-400">
          <button @click="closeModal">
            <CwaUiIconXMarkIcon class="cwa-h-10" />
          </button>
        </div>
        <div class="cwa-p-4 cwa-flex cwa-justify-center">
          <div class="cwa-w-full cwa-max-w-xl cwa-flex cwa-items-center cwa-space-x-2">
            <div class="cwa-max-w-[calc(100%-1.3em)]">
              <input
                v-if="isEditingTitle"
                v-model="titleModel"
                v-auto-width="{ comfortZone: '.5rem', minWidth: '270px' }"
                class="cwa-dark-blur cwa-text-4xl cwa-py-1 cwa-px-2 cwa-max-w-full -cwa-ml-2 cwa-placeholder-light/20"
                placeholder="Enter Reference"
              >
              <h2 v-else class="cwa-text-4xl cwa-truncate cwa-py-1 cwa-pr-3 cwa-border cwa-border-transparent" :class="[titleModel ? '' : 'cwa-text-light/20']">
                {{ titleModel || '[No Reference]' }}
              </h2>
            </div>
            <div class="cwa-flex-shrink-0 cwa-w-[1.3em] cwa-cursor-pointer">
              <CwaUiIconTickIcon v-if="isEditingTitle" class="cwa-w-full" @click="saveTitle()" />
              <CwaUiIconPenIcon v-else class="cwa-w-full" @click="isEditingTitle = true" />
            </div>
          </div>
        </div>
        <ResourceLoadingIndicator class="cwa-absolute cwa-top-full cwa-left-0 cwa-z-10" />
      </div>
      <div class="cwa-grow cwa-px-4 cwa-pt-4 cwa-pb-10 cwa-flex cwa-justify-center cwa-min-h-0">
        <div class="cwa-w-full cwa-max-w-xl cwa-overflow-auto">
          <slot />
        </div>
      </div>
    </template>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'

import { directive as vAutoWidth } from 'vue-input-autowidth'
import ResourceLoadingIndicator from '#cwa/runtime/templates/components/main/admin/_common/ResourceLoadingIndicator.vue'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'

// eslint-disable-next-line vue/require-prop-types
const titleModel = defineModel()
const emit = defineEmits(['close', 'save'])
defineProps<{
  isLoading?: boolean
}>()

const isEditingTitle = ref(false)

function closeModal () {
  emit('close')
}

function saveTitle () {
  emit('save')
  isEditingTitle.value = false
}
</script>

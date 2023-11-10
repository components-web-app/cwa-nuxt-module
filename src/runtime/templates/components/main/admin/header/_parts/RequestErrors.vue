<script setup lang="ts">
import ValidationError from './ValidationError.vue'
import { useCwa } from '#imports'
import { ErrorType } from '#cwa/runtime/storage/stores/error/state'

const $cwa = useCwa()
</script>

<template>
  <ul v-if="$cwa.resourcesManager.hasErrors" class="cwa-absolute cwa-right-0 cwa-min-w-[300px] cwa-top-30 cwa-dark-blur cwa-z-50 cwa-max-w-lg cwa-max-h-96 cwa-overflow-auto cwa-p-2 cwa-flex cwa-col cwa-space-y-2">
    <li v-for="error in $cwa.resourcesManager.errors" :key="error.timestamp" class="cwa-bg-stone-700">
      <div class="p-2">
        <ul v-if="error.type === ErrorType.VALIDATION">
          <ValidationError v-for="violation in error.violations" :key="`violation-${violation.property}-${error.timestamp}`" :violation="violation">
            {{ violation.property }}: {{ violation.message }}
          </ValidationError>
        </ul>
        <div v-else class="cwa-w-full cwa-overflow-auto">
          {{ error?.statusCode || 'Network Error' }}: {{ error.detail }}
        </div>
      </div>
      <div class="cwa-bg-dark cwa-p-2 cwa-text-sm cwa-text-light cwa-underline" @click="$cwa.resourcesManager.removeError(error.timestamp)">
        clear
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { useCwa } from '#imports'
import { ErrorType } from '#cwa/runtime/storage/stores/error/state'
import Notification from './Notification.vue'
import { computed } from 'vue'

const $cwa = useCwa()

function removeError(timestamp: number) {
  $cwa.resourcesManager.removeError(timestamp)
}

// todo: work out why when removing an index transitions do not work
const displayErrors = computed(() =>  {
  return $cwa.resourcesManager.errors
})
</script>

<template>
  <!-- Global notification live region, render this permanently at the end of the document -->
  <div v-if="$cwa.resourcesManager.hasErrors" aria-live="assertive" class="cwa-pointer-events-none cwa-fixed cwa-inset-0 cwa-flex cwa-items-end cwa-pt-20 cwa-pb-4 cwa-py-6 sm:cwa-px-4 sm:cwa-items-start cwa-z-50">
    <TransitionGroup
      tag="ul"
      class="cwa-list-none cwa-flex cwa-w-full cwa-flex-col cwa-items-center cwa-space-y-4 sm:cwa-items-end"
      enter-active-class="cwa-transform cwa-ease-out cwa-duration-300 cwa-transition"
      enter-from-class="cwa-translate-y-2 cwa-opacity-0 sm:cwa-translate-y-0 sm:cwa-translate-x-2"
      enter-to-class="cwa-translate-y-0 cwa-opacity-100 sm:cwa-translate-x-0"
      leave-active-class="cwa-transition cwa-ease-in cwa-duration-100"
      leave-from-class="cwa-opacity-100"
      leave-to-class="cwa-opacity-0"
      appear
    >
      <Notification
        v-for="(error, index) in displayErrors"
        :key="error.timestamp"
        :data-index="index"
        @clear="() => removeError(error.timestamp)"
      >
        <p class="cwa-text-md cwa-font-bold cwa-text-white">Oops! There was a problem.</p>
        <ul v-if="error.type === ErrorType.VALIDATION">
          <li v-for="violation in error.violations" :key="`violation-${violation.property}-${error.timestamp}`">
            {{ violation.property }}: {{ violation.message }}
          </li>
        </ul>
        <p v-else class="cwa-mt-1 cwa-text-sm cwa-text-gray-500">
          {{ error?.statusCode || 'Network Error' }}: {{ error.detail }}
        </p>
      </Notification>
    </TransitionGroup>
  </div>
</template>

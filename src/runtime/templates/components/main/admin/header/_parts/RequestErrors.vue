<script setup lang="ts">
import Notification from './Notification.vue'
import { useCwa } from '#imports'
import { ErrorType } from '#cwa/storage/stores/error/state'
import { useTransitions } from '#cwa/composables/transitions'

const $cwa = useCwa()
const { notification } = useTransitions()

function removeError(timestamp: number) {
  $cwa.resourcesManager.removeError(timestamp)
}
</script>

<template>
  <div
    aria-live="assertive"
    class="cwa:pointer-events-none cwa:fixed cwa:inset-0 cwa:flex cwa:items-end cwa:pt-20 cwa:pb-4 cwa:py-6 cwa:sm:px-4 cwa:sm:items-start cwa:z-notifications"
  >
    <TransitionGroup
      tag="ul"
      class="cwa:list-none cwa:flex cwa:w-full cwa:flex-col cwa:items-center cwa:gap-y-4 cwa:sm:items-end"
      v-bind="notification"
    >
      <Notification
        v-for="(error, index) in $cwa.resourcesManager.errors"
        :key="error.timestamp"
        :data-index="index"
        @clear="() => removeError(error.timestamp)"
      >
        <p class="cwa:text-md cwa:font-bold cwa:text-white">
          Oops! There was a problem.
        </p>
        <ul v-if="error.type === ErrorType.VALIDATION">
          <li
            v-for="violation in error.violations"
            :key="`violation-${violation.property}-${error.timestamp}`"
          >
            {{ violation.property }}: {{ violation.message }}
          </li>
        </ul>
        <p
          v-else
          class="cwa:mt-1 cwa:text-sm cwa:text-gray-500"
        >
          {{ error?.statusCode || 'Network Error' }}: {{ error.detail }}
        </p>
      </Notification>
    </TransitionGroup>
  </div>
</template>

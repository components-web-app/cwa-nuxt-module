<script setup lang="ts">
import { toDisplayString, watch } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { useCwaToast } from '#cwa/composables/cwa-toast'
import { ErrorType } from '#cwa/storage/stores/error/state'
import type { CwaErrorEvent } from '#cwa/storage/stores/error/state'

const $cwa = useCwa()
const toast = useCwaToast()

const toastId = (error: CwaErrorEvent) => `cwa-request-error-${error.timestamp}`

function description(error: CwaErrorEvent) {
  if (error.type === ErrorType.VALIDATION) {
    return (error.violations ?? []).map(violation => `${violation.property}: ${violation.message}`).join('\n')
  }
  return `${toDisplayString(error.statusCode || 'Network Error')}: ${toDisplayString(error.detail)}`
}

watch(() => [...$cwa.resourcesManager.errors], (errors, previous = []) => {
  const current = new Set(errors.map(error => error.timestamp))
  for (const error of previous) {
    if (!current.has(error.timestamp)) {
      toast.dismiss(toastId(error))
    }
  }
  for (const error of errors) {
    toast.show({
      id: toastId(error),
      tone: 'error',
      title: 'Oops! There was a problem.',
      description: description(error),
      onClose: () => $cwa.resourcesManager.removeError(error.timestamp),
    })
  }
}, { immediate: true })
</script>

<template>
  <span hidden />
</template>

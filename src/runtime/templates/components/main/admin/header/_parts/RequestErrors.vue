<script setup lang="ts">
import { onBeforeUnmount, toDisplayString, watch } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { useCwaToast } from '#cwa/composables/cwa-toast'
import { ErrorType } from '#cwa/storage/stores/error/state'
import type { CwaErrorEvent, CwaViolationError } from '#cwa/storage/stores/error/state'
import { unclaimedViolations } from '#cwa/admin/write-violations'

const $cwa = useCwa()
const toast = useCwaToast()

const toastId = (error: CwaErrorEvent) => `cwa-request-error-${error.timestamp}`

function toasted(error: CwaErrorEvent) {
  return !(error.event && 'onRequest' in error.event && error.event.onRequest)
}

function violationsOf(error: CwaErrorEvent): CwaViolationError[] {
  return error.type === ErrorType.VALIDATION ? unclaimedViolations($cwa, error) : []
}

function onFields(error: CwaErrorEvent) {
  return error.type === ErrorType.VALIDATION && !!error.violations?.length && !violationsOf(error).length
}

function description(error: CwaErrorEvent) {
  if (error.type === ErrorType.VALIDATION) {
    return violationsOf(error).map(violation => `${violation.property}: ${violation.message}`).join('\n')
  }
  return `${toDisplayString(error.statusCode || 'Network Error')}: ${toDisplayString(error.detail)}`
}

watch(() => $cwa.resourcesManager.errors.filter(toasted), (errors, previous = []) => {
  const current = new Set(errors.map(error => error.timestamp))
  for (const error of previous) {
    if (!current.has(error.timestamp)) {
      toast.dismiss(toastId(error))
    }
  }
  for (const error of errors) {
    if (onFields(error)) {
      $cwa.resourcesManager.removeError(error.timestamp)
      continue
    }
    toast.show({
      id: toastId(error),
      tone: 'error',
      title: 'Oops! There was a problem.',
      description: description(error),
      onClose: () => $cwa.resourcesManager.removeError(error.timestamp),
    })
  }
}, { immediate: true })

onBeforeUnmount(() => {
  for (const error of $cwa.resourcesManager.errors.filter(toasted)) {
    toast.dismiss(toastId(error))
  }
})
</script>

<template>
  <span hidden />
</template>

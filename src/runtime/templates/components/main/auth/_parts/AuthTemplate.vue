<template>
  <div class="cwa:flex cwa:min-h-full cwa:flex-col cwa:justify-center cwa:py-12 cwa:sm:px-6 cwa:lg:px-8 cwa:bg-dark">
    <div class="cwa:sm:mx-autocwa:sm::w-full cwa:sm::max-w-md">
      <CwaLogo class="cwa:mx-auto cwa:h-12 cwa:w-auto cwa:text-neutral-400" />
    </div>

    <div class="cwa:mt-8 cwa:sm:mx-auto cwa:sm:w-full cwa:sm:max-w-md cwa:text-white">
      <div class="cwa:bg-neutral-800 cwa:py-8 cwa:px-4 cwa:shadow cwa:sm:px-10">
        <CwaUiAlertWarning
          v-if="error"
          class="cwa:mb-4"
        >
          {{ error }}
        </CwaUiAlertWarning>
        <form
          ref="form"
          action="#"
          method="post"
          class="cwa:flex cwa:flex-col cwa:gap-y-6"
          @submit.prevent="$emit('submit')"
        >
          <slot />
          <div v-if="!hideSubmit">
            <button
              type="submit"
              :disabled="submitting"
              :class="{ 'cwa:opacity-50': submitting }"
              class="cwa:cursor-pointer cwa:flex cwa:w-full cwa:justify-center cwa:bg-neutral-600 cwa:py-2 cwa:px-3 cwa:text-sm cwa:font-semibold cwa:text-white cwa:shadow-sm cwa:hover:bg-neutral-500 cwa:focus-visible:outline cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-neutral-600"
            >
              {{ submitButtonText }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'

defineEmits(['submit'])
defineProps<{
  submitButtonText: string
  submitting: boolean
  error?: string | null | string[]
  hideSubmit?: boolean
}>()

const form = useTemplateRef('form')

function submitForm() {
  if (!form.value) {
    return
  }
  form.value.submit()
}

defineExpose({
  submitForm,
})
</script>

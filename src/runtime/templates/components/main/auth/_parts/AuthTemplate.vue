<template>
  <div class="cwa-flex cwa-min-h-full cwa-flex-col cwa-justify-center cwa-py-12 sm:cwa-px-6 lg:cwa-px-8">
    <div class="sm:cwa-mx-auto sm:cwa-w-full sm:cwa-max-w-md">
      <CwaLogo class="cwa-mx-auto cwa-h-12 cwa-w-auto cwa-text-neutral-400" />
    </div>

    <div class="cwa-mt-8 sm:cwa-mx-auto sm:cwa-w-full sm:cwa-max-w-md cwa-text-white">
      <div class="cwa-bg-neutral-800 cwa-py-8 cwa-px-4 cwa-shadow sm:cwa-px-10">
        <CwaUiAlertWarning v-if="error" class="cwa-mb-4">
          {{ error }}
        </CwaUiAlertWarning>
        <form action="#" class="cwa-space-y-6" @submit.prevent="$emit('submit')">
          <slot />
          <div>
            <button
              type="submit"
              :disabled="submitting"
              :class="{ 'cwa-opacity-50': submitting }"
              class="cwa-flex cwa-w-full cwa-justify-center cwa-bg-neutral-600 cwa-py-2 cwa-px-3 cwa-text-sm cwa-font-semibold cwa-text-white cwa-shadow-sm hover:cwa-bg-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-600"
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
defineEmits(['submit'])
defineProps<{
  submitButtonText: string,
  submitting: boolean,
  error?: string
}>()
</script>

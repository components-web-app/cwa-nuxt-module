<template>
  <div class="cwa:flex cwa:min-h-full cwa:flex-col cwa:justify-center cwa:bg-stone-950 cwa:py-12 cwa:sm:px-6 cwa:lg:px-8">
    <CwaLogo
      aria-hidden="true"
      class="cwa:mx-auto cwa:h-12 cwa:w-auto cwa:max-w-full cwa:px-4 cwa:text-fg-muted"
    />

    <main class="cwa:mt-8 cwa:w-full cwa:sm:mx-auto cwa:sm:max-w-md">
      <div
        data-testid="auth-card"
        class="cwa:bg-surface cwa:px-4 cwa:py-8 cwa:text-control cwa:text-fg cwa:shadow-popover cwa:[--cwa-spacing-control:var(--cwa-spacing-control-lg)] cwa:[--cwa-text-control:var(--cwa-text-control-lg)] cwa:sm:px-10"
      >
        <h1
          v-if="title"
          class="cwa:mt-0 cwa:mb-stack cwa:text-title cwa:text-fg"
        >
          {{ title }}
        </h1>
        <p
          role="status"
          data-testid="auth-announcement"
          class="cwa:sr-only"
        >
          {{ announcement }}
        </p>
        <CwaUiAlert
          v-if="errorText"
          tone="danger"
          :title="errorText"
          data-testid="auth-error"
          class="cwa:mb-stack"
        />
        <CwaUiAlert
          v-else-if="success"
          tone="success"
          :title="success"
          data-testid="auth-success"
          class="cwa:mb-stack"
        >
          <slot
            v-if="$slots.success"
            name="success"
          />
        </CwaUiAlert>
        <form
          ref="form"
          action="#"
          method="post"
          class="cwa:flex cwa:flex-col cwa:gap-y-stack"
          @submit.prevent="$emit('submit')"
        >
          <slot />
          <CwaUiButton
            v-if="!hideSubmit"
            type="submit"
            variant="solid"
            :label="submitButtonText"
            :loading="submitting"
            class="cwa:w-full"
          />
        </form>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, useTemplateRef } from 'vue'
import CwaUiAlert from '../../../ui/Alert.vue'
import CwaUiButton from '../../../ui/Button.vue'
import { formSurfaceKey } from '../../../core/ui/field-keys'

defineEmits(['submit'])
const props = defineProps<{
  title?: string
  submitButtonText: string
  submitting: boolean
  error?: string | null | string[]
  success?: string
  hideSubmit?: boolean
}>()

provide(formSurfaceKey, { unsaved: () => false, register: () => () => {} })

const errorText = computed(() => (Array.isArray(props.error) ? props.error.join(' ') : props.error) || undefined)

const announcement = computed(() => errorText.value ?? props.success ?? '')

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
defineSlots<{
  default(): any
  success?(): any
}>()
</script>

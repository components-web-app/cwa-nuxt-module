<template>
  <TransitionRoot
    as="template"
    :show="isOpen"
  >
    <Dialog
      as="div"
      class="cwa:relative cwa:z-dialog"
      @close="setIsOpen"
    >
      <TransitionChild
        as="template"
        enter="cwa:ease-out cwa:duration-300"
        enter-from="cwa:opacity-0"
        enter-to="cwa:opacity-100"
        leave="cwa:ease-in cwa:duration-200"
        leave-from="cwa:opacity-100"
        leave-to="cwa:opacity-0"
      >
        <div class="cwa:fixed cwa:inset-0 cwa:dark-blur cwa:transition-opacity" />
      </TransitionChild>

      <div class="cwa:fixed cwa:inset-0 cwa:z-10 cwa:w-screen cwa:overflow-y-auto">
        <div class="cwa:flex cwa:min-h-full cwa:items-end cwa:justify-center cwa:p-4 cwa:text-center cwa:sm:items-center">
          <TransitionChild
            as="template"
            enter="cwa:ease-out cwa:duration-300"
            enter-from="cwa:opacity-0 cwa:translate-y-4 cwa:sm:translate-y-0 cwa:sm:scale-95"
            enter-to="cwa:opacity-100 cwa:translate-y-0 cwa:sm:scale-100"
            leave="cwa:duration-0"
            leave-from="cwa:opacity-100"
            leave-to="cwa:opacity-0"
          >
            <DialogPanel :class="panelClassName">
              <div class="cwa:sm:flex cwa:sm:items-start">
                <div class="w-full">
                  <DialogTitle
                    as="h3"
                    class="cwa:text-xl cwa:sm:text-4xl cwa:font-normal cwa:border-b cwa:border-stone-600 cwa:px-6 cwa:pb-4  cwa:dark-blur cwa:pt-5"
                  >
                    {{ title }}
                  </DialogTitle>
                  <div class="cwa:px-6 cwa:py-6 cwa:bg-dark">
                    <slot />
                  </div>
                </div>
              </div>
              <div class="cwa:px-6 cwa:py-5 cwa:sm:flex cwa:sm:flex-row-reverse cwa:gap-y-2 cwa:sm:gap-y-0 cwa:sm:gap-x-6 cwa:sm:gap-x-reverse cwa:dark-blur cwa:border-t cwa:border-stone-600">
                <slot name="buttons">
                  <CwaUiFormButton
                    v-for="button of buttons"
                    :key="`dialog-button-${button.label}`"
                    :color="button.color"
                    :button-class="button.buttonClass"
                    :disabled="!!button.disabled || isLoading"
                    @click="!button.disabled && (button?.callbackFn ? button.callbackFn() : setIsOpen(false))"
                  >
                    {{ button.label }}
                  </CwaUiFormButton>
                </slot>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'
import type { ButtonColor } from '#cwa/runtime/templates/components/ui/form/Button.vue'

export interface ActionButton {
  label: string
  color: ButtonColor
  buttonClass?: string
  callbackFn?: () => void
  disabled?: boolean
}

const isOpen = defineModel<boolean>({ default: false })

withDefaults(defineProps<{
  title?: string
  buttons?: ActionButton[]
  isLoading?: boolean
}>(), {
  title: '',
  buttons: () => ([
    {
      color: 'blue',
      buttonClass: 'cwa:min-w-[120px]',
      label: 'Done',
    },
    {
      color: 'grey',
      label: 'Cancel',
    },
  ]),
  isLoading: false,
})

function setIsOpen(value?: boolean) {
  isOpen.value = !!value
}

const panelClassName = computed(() => {
  return 'cwa:relative cwa:transform cwa:overflow-hidden cwa:rounded-xl cwa:text-white cwa:text-left cwa:shadow-xl cwa:transition-all cwa:sm:my-8 cwa:sm:w-full cwa:sm:max-w-3xl'
})
</script>

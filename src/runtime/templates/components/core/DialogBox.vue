<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog as="div" class="cwa-relative cwa-z-50" @close="setIsOpen">
      <TransitionChild
        as="template"
        enter="cwa-ease-out cwa-duration-300"
        enter-from="cwa-opacity-0"
        enter-to="cwa-opacity-100"
        leave="cwa-ease-in cwa-duration-200"
        leave-from="cwa-opacity-100"
        leave-to="cwa-opacity-0"
      >
        <div class="cwa-fixed cwa-inset-0 cwa-dark-blur cwa-transition-opacity" />
      </TransitionChild>

      <div class="cwa-fixed cwa-inset-0 cwa-z-10 cwa-w-screen cwa-overflow-y-auto">
        <div class="cwa-flex cwa-min-h-full cwa-items-end cwa-justify-center cwa-p-4 cwa-text-center sm:cwa-items-center">
          <TransitionChild
            as="template"
            enter="cwa-ease-out cwa-duration-300"
            enter-from="cwa-opacity-0 cwa-translate-y-4 sm:cwa-translate-y-0 sm:cwa-scale-95"
            enter-to="cwa-opacity-100 cwa-translate-y-0 sm:cwa-scale-100"
            leave="cwa-ease-in cwa-duration-200"
            leave-from="cwa-opacity-100 cwa-translate-y-0 sm:cwa-scale-100"
            leave-to="cwa-opacity-0 cwa-translate-y-4 sm:cwa-translate-y-0 sm:cwa-scale-95"
          >
            <DialogPanel :class="panelClassName">
              <div class="sm:cwa-flex sm:cwa-items-start">
                <div class="w-full">
                  <DialogTitle as="h3" class="cwa-text-xl sm:cwa-text-4xl cwa-font-normal cwa-border-b cwa-px-6 cwa-pb-4 cwa-border-stone-600 cwa-mb-4">
                    {{ title }}
                  </DialogTitle>
                  <div class="cwa-mt-2 cwa-px-6">
                    <slot />
                  </div>
                </div>
              </div>
              <div class="cwa-px-6 cwa-mt-8 sm:cwa-flex sm:cwa-flex-row-reverse cwa-space-y-2 sm:cwa-space-y-0 sm:cwa-space-x-6 sm:cwa-space-x-reverse">
                <slot name="buttons">
                  <CwaUiFormButton v-for="button of buttons" :key="`dialog-button-${button.label}`" :color="button.color" :button-class="button.buttonClass" @click="button?.callbackFn ? button.callbackFn() : setIsOpen(false)">
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
}

const isOpen = defineModel<boolean>({ default: false })

withDefaults(defineProps<{
  title: string,
  buttons: ActionButton[]
}>(), {
  title: '',
  buttons: () => ([
    {
      color: 'blue',
      buttonClass: 'cwa-min-w-[120px]',
      label: 'Done'
    },
    {
      color: 'grey',
      label: 'Cancel'
    }
  ])
})

function setIsOpen (value?: boolean) {
  isOpen.value = !!value
}

const panelClassName = computed(() => {
  return 'cwa-relative cwa-transform cwa-overflow-hidden cwa-rounded-lg cwa-bg-dark cwa-text-white cwa-pb-4 cwa-pt-5 cwa-text-left cwa-shadow-xl cwa-transition-all sm:cwa-my-8 sm:cwa-w-full sm:cwa-max-w-3xl'
})
</script>

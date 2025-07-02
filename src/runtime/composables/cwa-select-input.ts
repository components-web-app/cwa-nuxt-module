import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import isEqual from 'lodash-es/isEqual'
import { defu } from 'defu'
import type { PopperOptions } from '#cwa/runtime/types/popper'
import { usePopper } from '#cwa/runtime/composables/popper'

type ModelValue = undefined | string | number | boolean | object | null | (string | number | boolean | object)[]
export interface SelectOption {
  label: string
  value: ModelValue
  disabled?: boolean
}

export type SelectInputProps = {
  options: SelectOption[]
  modelValue: ModelValue
  popper?: PopperOptions
}

export const useCwaSelectInput = (inputProps: ComputedRef<SelectInputProps>, emit: (event: 'update:modelValue', ...args: any[]) => void) => {
  const value = computed({
    get() {
      return inputProps.value.modelValue
    },
    set(value) {
      emit('update:modelValue', value)
    },
  })

  const ops = {
    popper: {
      placement: 'bottom-start',
    },
  }

  const selectedOption = computed(() => {
    return inputProps.value.options.find(({ value }) => isEqual(value, inputProps.value.modelValue)) || inputProps.value.options[0] || null
  })
  const popperOps = computed<PopperOptions>(() => defu({}, inputProps.value.popper, ops.popper as PopperOptions))
  const [trigger, container] = usePopper(popperOps.value)

  function compareOptions(a: ModelValue, b: ModelValue) {
    if (a === undefined && b === null) {
      return true
    }
    return isEqual(a, b)
  }

  return {
    value,
    compareOptions,
    selectedOption,
    trigger,
    container,
  }
}

import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import isEqual from 'lodash-es/isEqual'
import { defu } from 'defu'
import type { PopperOptions } from '#cwa/types/popper'
import { usePopper } from '#cwa/composables/popper'

type ModelValue = undefined | string | number | boolean | object | null | (string | number | boolean | object)[]
export interface SelectOption {
  label: string
  value: ModelValue
  disabled?: boolean
}

export type SelectInputProps = {
  options: SelectOption[]
  modelValue: ModelValue
  multiple?: boolean
  placeholder?: string
  popper?: PopperOptions
}

export const useCwaSelectInput = (inputProps: ComputedRef<SelectInputProps>, emit: (event: 'update:modelValue', ...args: any[]) => void) => {
  const value = computed({
    get() {
      const current = inputProps.value.modelValue
      if (inputProps.value.multiple) {
        return Array.isArray(current) ? current : []
      }
      return current
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

  const selectedOptions = computed<SelectOption[]>(() => {
    if (inputProps.value.multiple) {
      const selected = Array.isArray(inputProps.value.modelValue) ? inputProps.value.modelValue : []
      return inputProps.value.options.filter(o => selected.some(v => isEqual(v, o.value)))
    }
    const match = inputProps.value.options.find(({ value }) => isEqual(value, inputProps.value.modelValue))
    return match ? [match] : []
  })

  const displayLabel = computed<string>(() => {
    const labels = selectedOptions.value.map(o => o.label)
    if (labels.length) {
      return labels.join(', ')
    }
    if (inputProps.value.multiple) {
      return inputProps.value.placeholder ?? ''
    }
    return inputProps.value.placeholder ?? selectedOption.value?.label ?? ''
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
    selectedOptions,
    displayLabel,
    trigger,
    container,
  }
}

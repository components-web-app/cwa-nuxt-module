import { computed } from 'vue'
import { isEqual } from 'lodash-es'
import { defu } from 'defu'
import type { PopperOptions } from '#cwa/runtime/types/popper'
import { usePopper } from '#cwa/runtime/composables/popper'

type ModelValue = undefined | string | number | boolean | object | null | (string | number | boolean | object)[]
export interface SelectOption {
  label: string,
  value: ModelValue,
  disabled?: boolean
}

export type SelectInputProps = {
  options: SelectOption[],
  modelValue: ModelValue,
  popper?: PopperOptions,
  id?: string
}

export const useCwaSelectInput = (props: SelectInputProps, emit: (event: 'update:modelValue', ...args: any[]) => void) => {
  const value = computed({
    get () {
      return props.modelValue
    },
    set (value) {
      emit('update:modelValue', value)
    }
  })

  const ops = {
    popper: {
      placement: 'bottom-start'
    }
  }

  const selectedOption = computed(() => {
    return props.options.find(({ value }) => isEqual(value, props.modelValue)) || props.options[0] || null
  })
  const popperOps = computed<PopperOptions>(() => defu({}, props.popper, ops.popper as PopperOptions))
  const [trigger, container] = usePopper(popperOps.value)

  function compareOptions (a: ModelValue, b: ModelValue) {
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
    container
  }
}

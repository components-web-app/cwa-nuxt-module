import { ref, watch } from 'vue'
import type { Ref } from 'vue'
import isEqual from 'lodash-es/isEqual'

export type ModelValue = undefined | string | number | boolean | object | null | (string | number | boolean | object)[]

export interface SelectOption {
  label: string
  value: ModelValue
  disabled?: boolean
}

export const useCwaSelect = (model: Ref<ModelValue>, ops: SelectOption[] = []) => {
  // use a new model - prevent updating the model and immediately triggering updates
  const selectModel = ref<ModelValue>(model.value)
  const options = ref<SelectOption[]>(ops)
  watch(options, (newOptions) => {
    const selectOption = newOptions.find((op) => {
      return isEqual(op.value, model.value)
    })
    selectModel.value = selectOption?.value
  })
  watch(selectModel, () => {
    if (selectModel.value !== model.value) {
      model.value = selectModel.value
    }
  })
  watch(model, (newModelValue) => {
    selectModel.value = newModelValue
  })
  return {
    model: selectModel,
    options,
  }
}

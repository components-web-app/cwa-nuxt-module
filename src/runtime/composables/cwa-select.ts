import { type Ref, ref, watch } from 'vue'
import { isEqual } from 'lodash-es'
import type { SelectOption } from './cwa-select-input'
import type { ModelValue } from '#cwa/runtime/templates/components/ui/form/Button.vue'

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
    options
  }
}

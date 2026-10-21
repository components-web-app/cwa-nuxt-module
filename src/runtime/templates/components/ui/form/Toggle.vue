<script setup lang="ts">
import { Switch, SwitchGroup, SwitchLabel } from '@headlessui/vue'
import { computed } from 'vue'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import RemoteChangeConflict from '#cwa/templates/components/core/admin/form/RemoteChangeConflict.vue'
import FieldPresence from '#cwa/templates/components/ui/FieldPresence.vue'

const emit = defineEmits(['update:modelValue'])
const { modelValue, disabled = false, model: field } = defineProps<{
  label: string
  modelValue?: boolean | undefined | null
  disabled?: boolean
  model?: ResourceModelField<boolean>
}>()

const current = computed(() => field ? field.model.value : modelValue)
const remoteChange = computed(() => field?.remoteChange.value)

const valueAsBoolean = computed<boolean>({
  get() {
    return !!current.value
  },
  set(value) {
    handleSwitchInput(value)
  },
})

function handleSwitchInput(newValue: boolean) {
  if (field) {
    // eslint-disable-next-line vue/no-mutating-props
    field.model.value = newValue
    return
  }
  emit('update:modelValue', newValue)
}
</script>

<template>
  <FieldPresence
    :model="field"
    class="cwa:flex cwa:items-center"
    v-bind="field?.focusListeners"
  >
    <SwitchGroup
      as="div"
      class="cwa:flex cwa:items-center"
    >
      <Switch
        :model-value="valueAsBoolean"
        :disabled="disabled"
        :class="[
          current ? 'cwa:bg-indigo-600' : 'cwa:bg-gray-200', disabled ? 'cwa:opacity-50 cwa:cursor-not-allowed' : 'cwa:cursor-pointer', 'cwa:relative cwa:inline-flex cwa:h-6 cwa:w-11 cwa:shrink-0 cwa:border-2 cwa:border-transparent cwa:transition-colors cwa:duration-200 cwa:ease-in-out cwa:rounded-full',
        ]"
        @update:model-value="handleSwitchInput"
      >
        <span
          aria-hidden="true"
          :class="[current ? 'cwa:translate-x-5' : 'cwa:translate-x-0', 'cwa:pointer-events-none cwa:inline-block cwa:h-5 cwa:w-5 cwa:transform cwa:bg-white cwa:shadow cwa:ring-0 cwa:transition cwa:duration-200 cwa:ease-in-out cwa:rounded-full']"
        />
      </Switch>

      <SwitchLabel
        as="span"
        class="cwa:ml-3 cwa:text-sm"
        :class="disabled ? 'cwa:opacity-50 cwa:cursor-not-allowed' : 'cwa:cursor-pointer'"
      >
        <span class="cwa:font-medium">{{ label }}</span>
      </SwitchLabel>
      <RemoteChangeConflict
        v-if="remoteChange"
        class="cwa:ml-3"
        :change="remoteChange"
      />
    </SwitchGroup>
  </FieldPresence>
</template>

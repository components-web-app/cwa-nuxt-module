<script setup lang="ts">
import { computed } from 'vue'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import RemoteChangeConflict from '#cwa/templates/components/core/admin/form/RemoteChangeConflict.vue'

defineOptions({ inheritAttrs: false })

type InputValue = string | number | undefined | null

const { model: field } = defineProps<{
  model?: ResourceModelField<InputValue>
}>()

const [vModel, modifiers] = defineModel<InputValue>()

const value = computed<InputValue>({
  get: () => field ? field.model.value : vModel.value,
  set(next) {
    if (modifiers.nullable) {
      next ||= null
    }
    if (field) {
      // eslint-disable-next-line vue/no-mutating-props
      field.model.value = next
      return
    }
    vModel.value = next
  },
})

const remoteChange = computed(() => field?.remoteChange.value)

const inputClass = 'cwa:disabled:opacity-50 cwa:disabled:cursor-not-allowed cwa:disabled:pointer-events-none cwa:disabled:select-none cwa:text-light cwa:w-full cwa:dark-blur cwa:border-0 cwa:outline-dotted cwa:outline-1 cwa:outline-stone-700 cwa:[outline-offset:-1px] cwa:hover:outline-stone-400 cwa:focus-visible:ring-0 cwa:focus-visible:[outline-style:solid] cwa:focus-visible:outline-2 cwa:focus-visible:outline-stone-500 cwa:focus-visible:[outline-offset:-2px]'
</script>

<template>
  <div
    v-if="field"
    class="cwa:flex cwa:w-full cwa:items-center cwa:gap-x-3"
  >
    <input
      v-model="value"
      v-bind="$attrs"
      :class="inputClass"
    >
    <RemoteChangeConflict
      v-if="remoteChange"
      :change="remoteChange"
    />
  </div>
  <input
    v-else
    v-model="value"
    v-bind="$attrs"
    :class="inputClass"
  >
</template>

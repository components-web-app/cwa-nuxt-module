<template>
  <label :for="inputId">
    <input
      :id="inputId"
      ref="checkbox"
      v-model="model"
      class="cwa-sr-only cwa-peer/checkbox"
      type="checkbox"
      :value="value"
    >
    <button :class="['cwa-transition-opacity', 'cwa-border-2', 'cwa-rounded', 'cwa-py-1', 'cwa-px-4', 'cwa-opacity-50', 'peer-checked/checkbox:cwa-opacity-100', backgroundColorClass, borderColorClass]" @click="toggleCheckbox">
      {{ label }}
    </button>
  </label>
</template>

<script lang="ts" setup>
import { useId } from '#app'
import { ref, computed, defineEmits } from 'vue'

const props = defineProps<{
  modelValue: string[]
  value: string
  label: string
  backgroundColorClass: string
  borderColorClass: string
}>()

const inputId = useId()
const checkbox = ref()

const emit = defineEmits(['update:modelValue'])
function toggleCheckbox () {
  if (isChecked.value) {
    model.value = model.value.filter((v) => {
      return v !== props.value
    })
    return
  }
  // model.value.push here does not trigger reactivity for watching model in parent
  model.value = [...model.value, props.value]
}

const model = computed({
  get () {
    return props.modelValue
  },
  set (value) {
    emit('update:modelValue', value)
  }
})

const isChecked = computed(() => {
  return model.value.includes(props.value)
})
</script>

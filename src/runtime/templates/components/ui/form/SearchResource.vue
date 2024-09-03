<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CwaUiFormInput from './Input.vue'
import { useCwa } from '#imports'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'

const props = defineProps<{
  modelValue: string|undefined|null,
  endpoint: string
  property: string
}>()

const emit = defineEmits(['update:modelValue'])

const $cwa = useCwa()

const selectedResource = ref<CwaResource>()
const searchValue = ref()
const fetchingCurrentResource = ref(0)
const fetchCurrentCount = ref(0)
const value = computed({
  get () {
    return props.modelValue
  },
  set (value) {
    emit('update:modelValue', value)
  }
})
const resourcePropertyValue = computed(() => {
  return selectedResource.value?.[props.property]
})

async function fetchResource () {
  if (!value.value) {
    selectedResource.value = undefined
    return
  }
  fetchingCurrentResource.value = ++(fetchCurrentCount.value)
  selectedResource.value = await $cwa.fetchResource({
    path: `${value.value}`
  })
  if (fetchCurrentCount.value === fetchingCurrentResource.value) {
    fetchingCurrentResource.value = 0
  }
}

watch(value, () => {
  fetchResource()
}, {
  immediate: true
})
watch(resourcePropertyValue, (newResourcePropertyValue) => {
  searchValue.value = newResourcePropertyValue
})
</script>

<template>
  <div>
    <div>
      <CwaUiFormInput v-model="searchValue" :disabled="fetchingCurrentResource !== 0" />
    </div>
  </div>
</template>

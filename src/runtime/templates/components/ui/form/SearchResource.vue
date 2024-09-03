<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CwaUiFormInput from './Input.vue'
import { useCwa } from '#imports'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'

const props = defineProps<{
  modelValue: string|undefined|null,
  endpoint: string
  property: string
  notNullable?: boolean
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

function clearResource () {
  if (props.notNullable) {
    return
  }
  window.alert('Will clear the resource - set as null')
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
  <div class="cwa-flex cwa-items-center cwa-space-x-2">
    <div class="cwa-relative">
      <CwaUiFormInput v-model="searchValue" class="cwa-pr-8" :disabled="fetchingCurrentResource !== 0" />
      <button v-if="!notNullable && !!resourcePropertyValue" class="cwa-absolute cwa-right-1 cwa-top-1/2 -cwa-translate-y-1/2 cwa-opacity-50 hover:cwa-opacity-100 cwa-transition" @click="clearResource">
        <CwaUiIconXMarkIcon class="cwa-w-6" />
      </button>
    </div>
  </div>
</template>

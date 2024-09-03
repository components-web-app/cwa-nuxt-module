<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { debounce } from 'lodash-es'
import CwaUiFormInput from './Input.vue'
import { useCwa } from '#imports'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'

const props = defineProps<{
  modelValue: string|undefined|null,
  endpoint: string
  property: string
  searchProperties?: string[]
  notNullable?: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const $cwa = useCwa()

const selectedResource = ref<CwaResource>()
const searchValue = ref<string>()
const fetchingCurrentResource = ref(0)
const fetchCurrentCount = ref(0)
const fetchingSearchValue = ref()
const debounceFetchActive = ref(false)
const fetchingSearchResults = ref(false)
const searchResults = ref<CwaResource[]>()
let debouncedSearchCall: any

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
const showLoadingIndicator = computed(() => {
  return fetchingSearchResults.value || debounceFetchActive.value
})
const displaySearchResults = computed(() => {
  if (!searchResults.value) {
    return
  }
  return searchResults.value.reduce((a, v) => ({ ...a, [v['@id']]: v[props.property] }), {})
})

async function fetchResource () {
  if (!value.value) {
    selectedResource.value = undefined
    return
  }
  fetchingCurrentResource.value = ++(fetchCurrentCount.value)
  const newResource = await $cwa.fetchResource({
    path: `${value.value}`
  })
  if (fetchCurrentCount.value === fetchingCurrentResource.value) {
    selectedResource.value = newResource
    fetchingCurrentResource.value = 0
  }
}

async function search () {
  debounceFetchActive.value = false
  const searchParamsObj: { [key:string]: string } = {}
  if (fetchingSearchValue.value && fetchingSearchValue.value === searchValue.value) {
    return
  }
  if (!fetchingSearchValue.value && searchValue.value === resourcePropertyValue.value) {
    return
  }

  fetchingSearchValue.value = searchValue.value
  if (!searchValue.value) {
    searchResults.value = undefined
    fetchingSearchValue.value = undefined
    fetchingSearchResults.value = false
    return
  }
  fetchingSearchResults.value = true
  if (props.searchProperties) {
    for (const prop of props.searchProperties) {
      searchParamsObj[prop] = searchValue.value
    }
  } else {
    searchParamsObj[props.property] = searchValue.value
  }
  const params = new URLSearchParams(searchParamsObj)
  const query = params.toString()
  const path = `${props.endpoint}?${query}`
  const fetch = $cwa.fetch({
    path
  })
  const result = await fetch.response
  if (searchValue.value === fetchingSearchValue.value) {
    fetchingSearchResults.value = false
    searchResults.value = result._data?.['hydra:member']
  }
}

function clearResource () {
  if (props.notNullable) {
    return
  }
  window.alert('Will clear the resource - set as null')
}

watch(resourcePropertyValue, (newValue) => {
  searchValue.value = newValue
})

watch(value, () => {
  searchValue.value = ''
  fetchResource()
})

watch(searchValue, (newSearchValue) => {
  if (debouncedSearchCall) {
    debouncedSearchCall.cancel()
  }
  if (fetchingSearchValue.value && fetchingSearchValue.value === newSearchValue) {
    return
  }
  if (!fetchingSearchValue.value && newSearchValue === resourcePropertyValue.value) {
    return
  }

  debounceFetchActive.value = true
  debouncedSearchCall = debounce(search, 250)
  debouncedSearchCall()
})

onMounted(() => {
  fetchResource()
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
    <div v-if="showLoadingIndicator || !!searchResults">
      <pre class="cwa-h-20 cwa-overflow-auto cwa-bg-dark cwa-p-2 cwa-border">{{ showLoadingIndicator ? 'Loading...' : displaySearchResults }}</pre>
    </div>
  </div>
</template>

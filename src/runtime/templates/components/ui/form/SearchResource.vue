<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { debounce } from 'lodash-es'
import { Popover, PopoverPanel } from '@headlessui/vue'
import CwaUiFormInput from './Input.vue'
import { useCwa, usePopper } from '#imports'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
import ButtonPopoverItem from '#cwa/runtime/templates/components/ui/form/ButtonPopoverItem.vue'
import ButtonPopoverGroup from '#cwa/runtime/templates/components/ui/form/ButtonPopoverGroup.vue'
import type { ModelValue } from '#cwa/runtime/templates/components/ui/form/Button.vue'

const props = defineProps<{
  modelValue: ModelValue,
  endpoint: string
  property: string
  searchProperties?: string[]
  notNullable?: boolean
}>()

const emit = defineEmits<{(e: 'update:modelValue', value?: ModelValue): void }>()

const $cwa = useCwa()

const [trigger, container] = usePopper({
  placement: 'top-start',
  offsetDistance: 4
})

const selectedResource = ref<CwaResource>()
const searchValue = ref<string>()
const fetchingCurrentResource = ref(0)
const fetchCurrentCount = ref(0)
const fetchingSearchValue = ref()
const debounceFetchActive = ref(false)
const fetchingSearchResults = ref(false)
const searchResults = ref<CwaResource[]>()
const focussed = ref(false)
const open = computed(() => {
  return focussed.value && (showLoadingIndicator.value || !!searchResults.value)
})

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
  return fetchingCurrentResource.value === 0 && (fetchingSearchResults.value || debounceFetchActive.value)
})
const displaySearchResults = computed(() => {
  if (!searchResults.value) {
    return
  }
  return [...searchResults.value].reverse().map(result => ({ value: result['@id'], label: result[props.property] }))
})

async function fetchResource () {
  if (!value.value) {
    fetchingCurrentResource.value = 0
    selectedResource.value = undefined
    return
  }
  fetchingCurrentResource.value = ++(fetchCurrentCount.value)
  const newResource = await $cwa.fetchResource({
    path: `${value.value}`,
    noSave: false,
    shallowFetch: true
  })
  if (fetchCurrentCount.value === fetchingCurrentResource.value) {
    selectedResource.value = newResource
    fetchingCurrentResource.value = 0
  }
}

async function search () {
  debounceFetchActive.value = false
  const searchParamsObj: { [key:string]: string } = {
    perPage: '6',
    [`order[${props.property}]`]: 'asc'
  }
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
  value.value = null
}

function handleOptionClick (clickValue: ModelValue, close: () => void) {
  value.value = clickValue
  close()
  focussed.value = false
  searchValue.value = resourcePropertyValue.value
}
function unfocus () {
  setTimeout(() => {
    focussed.value = false
  }, 100)
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
  <Popover class="cwa-flex cwa-items-center cwa-space-x-2">
    <div ref="trigger" class="cwa-relative">
      <CwaUiFormInput v-model="searchValue" class="cwa-pr-8" :disabled="fetchingCurrentResource !== 0" @focus="focussed = true" @blur="unfocus" />
      <div v-if="fetchingCurrentResource !== 0" class="cwa-absolute cwa-top-1/2 -cwa-translate-y-1/2 cwa-left-2">
        <Spinner :show="true" />
      </div>
      <button v-if="!notNullable && !!resourcePropertyValue" class="cwa-absolute cwa-right-1 cwa-top-1/2 -cwa-translate-y-1/2 cwa-opacity-50 hover:cwa-opacity-100 cwa-transition" @click="clearResource">
        <CwaUiIconXMarkIcon class="cwa-w-6" />
      </button>
    </div>
    <div v-if="open">
      <PopoverPanel v-slot="{ close }" ref="container" static class="cwa-absolute cwa-max-h-60 cwa-min-w-full cwa-max-w-[300px] cwa-overflow-auto cwa-dark-blur cwa-border-0 cwa-outline-dotted cwa-outline-1 cwa-outline-stone-400">
        <div v-if="showLoadingIndicator">
          Loading...
        </div>
        <template v-for="(option, index) of displaySearchResults" v-else>
          <ButtonPopoverGroup v-if="Array.isArray(option)" :key="`popover-group-option-${index}`" :options="option" @click="(value: ModelValue) => handleOptionClick(value, close)" />
          <ButtonPopoverItem v-else :key="`popover-item-option-${index}`" :option="option" @click="(value: ModelValue) => handleOptionClick(value, close)" />
        </template>
      </PopoverPanel>
    </div>
  </Popover>
</template>

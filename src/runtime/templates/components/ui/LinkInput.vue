<script setup lang="ts">
import { computed } from 'vue'
import CwaUiEitherOr from './EitherOr.vue'
import CwaUiEitherOrOption from './EitherOrOption.vue'
import CwaUiResourceSearch from './ResourceSearch.vue'
import LinkUrlField from '../core/ui/LinkUrlField.vue'
import { isLinkUrl } from '#cwa/resources/link-url'
import type { CwaResource } from '#cwa/resources/resource-utils'

const { label = 'Link', info, route = 'route', rawPath = 'rawPath' } = defineProps<{
  label?: string
  info?: string
  route?: string
  rawPath?: string
}>()

const ops = computed(() => ({
  debounceTime: { [route]: 0 },
  valid: { [rawPath]: (value: unknown) => value === null || value === '' || isLinkUrl(value) },
}))

function routeLabel(resource: CwaResource) {
  return resource.path ?? resource['@id']
}
</script>

<template>
  <CwaUiEitherOr
    :label="label"
    :info="info"
    :ops="ops"
  >
    <CwaUiEitherOrOption
      label="Page"
      :fields="[route]"
    >
      <CwaUiResourceSearch
        :field="route"
        :label="`${label} page`"
        label-hidden
        endpoint="/_/routes"
        :search-params="['search', 'path']"
        :label-of="routeLabel"
        placeholder="Search pages"
      />
    </CwaUiEitherOrOption>
    <CwaUiEitherOrOption
      label="URL"
      :fields="[rawPath]"
    >
      <LinkUrlField
        :field="rawPath"
        :label="`${label} URL`"
      />
    </CwaUiEitherOrOption>
  </CwaUiEitherOr>
</template>

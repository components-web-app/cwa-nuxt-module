<template>
  <CwaUiFormButton
    color="grey"
    button-class="cwa-min-w-[100px]"
    :options="[
      [
        { label: 'Option 1', value: 'abc' },
        { label: 'Option 2', value: 'def' }
      ],
      { label: 'Clone', value: 'clone' }
    ]"
    @click="handleManagerCtaClick"
  >
    {{ buttonLabel }}
  </CwaUiFormButton>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { consola } from 'consola'
import { useCwa } from '#cwa/runtime/composables/cwa'
import type { ModelValue } from '#cwa/runtime/templates/components/ui/form/Button.vue'
import {
  CwaResourceTypes,
  getPublishedResourceState,
  getResourceTypeFromIri
} from '#cwa/runtime/resources/resource-utils'

const $cwa = useCwa()
const currentIri = $cwa.admin.componentManager.currentIri

const resourceType = computed(() => {
  return getResourceTypeFromIri(currentIri.value)
})

const buttonLabel = computed<'Publish'|undefined>(() => {
  if (resourceType.value !== CwaResourceTypes.COMPONENT) {
    return
  }
  const resource = $cwa.resources.getResource(currentIri.value).value
  if (!resource) {
    return
  }
  const publishedState = getPublishedResourceState(resource)
  if (publishedState !== false) {
    return
  }
  return 'Publish'
})

function handleDefaultClick () {
  if (!buttonLabel.value) {
    return
  }
  if (buttonLabel.value === 'Publish') {
    consola.log('DO PUBLISH')
  }
}

function handleManagerCtaClick (value?: ModelValue) {
  if (!value) {
    handleDefaultClick()
    return
  }
  consola.log('clicked', value)
}
</script>

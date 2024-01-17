<template>
  <CwaUiFormButton
    color="grey"
    button-class="cwa-min-w-[100px]"
    :options="buttonOptions"
    @click="handleManagerCtaClick"
  >
    {{ buttonLabel }}
  </CwaUiFormButton>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { consola } from 'consola'
import { useCwa } from '#cwa/runtime/composables/cwa'
import type { ButtonOption, ModelValue } from '#cwa/runtime/templates/components/ui/form/Button.vue'
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

const buttonOptions = computed(() => {
  const ops: (ButtonOption|ButtonOption[])[] = []

  if (resourceType.value === CwaResourceTypes.COMPONENT_POSITION || resourceType.value === CwaResourceTypes.COMPONENT) {
    ops.push([
      { label: 'Add Before', value: 'add-before' },
      { label: 'Add After', value: 'add-after' }
    ])
  } else if (resourceType.value === CwaResourceTypes.COMPONENT_GROUP) {
    ops.push([
      { label: 'Add to Start', value: 'add-before' },
      { label: 'Add to End', value: 'add-after' }
    ])
  }

  if (resourceType.value === CwaResourceTypes.COMPONENT) {
    ops.push({ label: 'Clone', value: 'clone' })
  }

  return ops
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

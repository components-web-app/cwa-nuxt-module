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
import { NEW_RESOURCE_IRI } from '#cwa/runtime/storage/stores/resources/state'

const $cwa = useCwa()
const currentIri = $cwa.admin.resourceStackManager.currentIri

const resourceType = computed(() => {
  return currentIri.value ? getResourceTypeFromIri(currentIri.value) : undefined
})

const isAddingNew = computed(() => {
  return currentIri.value === NEW_RESOURCE_IRI
})

const buttonLabel = computed<'Publish'|'Add Draft'|'Add'|undefined>(() => {
  if (!currentIri.value || (resourceType.value !== CwaResourceTypes.COMPONENT && !isAddingNew.value)) {
    return
  }
  const resource = $cwa.resources.getResource(currentIri.value).value
  if (!resource) {
    return
  }
  if (isAddingNew.value) {
    const addingMeta = resource.data?._metadata.adding
    return addingMeta?.isPublishable ? 'Add Draft' : 'Add'
  }
  const publishedState = getPublishedResourceState(resource)
  if (publishedState !== false) {
    return
  }
  return 'Publish'
})

const buttonOptions = computed(() => {
  const ops: (ButtonOption|ButtonOption[])[] = []

  if (isAddingNew.value) {
    ops.push({ label: 'Discard', value: 'add-discard' })

    const resource = $cwa.resources.getResource(NEW_RESOURCE_IRI).value
    if (!resource) {
      return ops
    }

    const addingMeta = resource.data?._metadata.adding
    if (addingMeta?.isPublishable) {
      ops.push({ label: 'Add and Publish', value: 'add-publish' })
    }
    return ops
  }

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

  if (buttonLabel.value === 'Add' || buttonLabel.value === 'Add Draft') {
    consola.log('Add or Add Draft')
  }
}

function handleAddEvent (value: 'add-before'|'add-after') {
  if (!currentIri.value) {
    return
  }
  const addAfter = value === 'add-after'
  $cwa.admin.resourceStackManager.initAddResource(currentIri.value, addAfter)
}

async function handleManagerCtaClick (value?: ModelValue) {
  if (!value) {
    handleDefaultClick()
    return
  }

  if (typeof value === 'string') {
    if (['add-before', 'add-after'].includes(value)) {
      handleAddEvent(value as 'add-before'|'add-after')
      return
    }

    if (['add-discard'].includes(value)) {
      await $cwa.admin.resourceStackManager.confirmDiscardAddingResource()
      return
    }

    if (['add-publish'].includes(value)) {
      consola.log('Add and PUBLISH', value)
    }
  }
}
</script>

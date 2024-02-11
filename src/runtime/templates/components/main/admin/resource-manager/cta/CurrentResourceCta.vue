<script lang="ts" setup>
import { computed } from 'vue'
import { DateTime } from 'luxon'
import {
  type CwaResource,
  CwaResourceTypes,
  getPublishedResourceState,
  getResourceTypeFromIri
} from '#cwa/runtime/resources/resource-utils'
import { useCwa } from '#cwa/runtime/composables/cwa'
import type { ButtonOption, ModelValue } from '#cwa/runtime/templates/components/ui/form/Button.vue'

const props = defineProps<{
  currentIri: string
  resource: CwaResource
}>()

const $cwa = useCwa()

const publishedState = computed(() => {
  if (!props.currentIri || !props.resource) {
    return
  }
  return getPublishedResourceState({ data: props.resource })
})

const resourceType = computed(() => {
  return props.currentIri ? getResourceTypeFromIri(props.currentIri) : undefined
})

const buttonLabel = computed<'Publish'|undefined>(() => {
  if (publishedState.value) {
    return
  }
  return 'Publish'
})

const buttonOptions = computed(() => {
  const ops: (ButtonOption|ButtonOption[])[] = []

  if (!$cwa.resources.isDataPage.value || $cwa.admin.resourceStackManager.isEditingLayout.value) {
    if (resourceType.value === CwaResourceTypes.COMPONENT_POSITION || resourceType.value === CwaResourceTypes.COMPONENT) {
      ops.push([
        {
          label: 'Add Before',
          value: 'add-before'
        },
        {
          label: 'Add After',
          value: 'add-after'
        }
      ])
    } else if (resourceType.value === CwaResourceTypes.COMPONENT_GROUP) {
      ops.push([
        {
          label: 'Add to Start',
          value: 'add-before'
        },
        {
          label: 'Add to End',
          value: 'add-after'
        }
      ])
    }
  }

  if (resourceType.value === CwaResourceTypes.COMPONENT) {
    ops.push({ label: 'Clone', value: 'clone' })
  }

  return ops
})

async function publishResource () {
  await $cwa.resourcesManager.updateResource({
    endpoint: props.currentIri,
    data: {
      publishedAt: DateTime.local().toUTC().toISO()
    }
  })
}

function handleManagerCtaClick (value?: ModelValue) {
  if (!value) {
    buttonLabel.value === 'Publish' && publishResource()
    return
  }

  if (typeof value === 'string') {
    if (['add-before', 'add-after'].includes(value)) {
      const addAfter = value === 'add-after'
      $cwa.admin.resourceStackManager.initAddResource(props.currentIri, addAfter)
    }

    if (value === 'clone') {
      // todo: handle clone
    }
  }
}
</script>

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

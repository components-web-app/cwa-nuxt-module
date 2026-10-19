<script lang="ts" setup>
import { computed, ref } from 'vue'
import {

  CwaResourceTypes,
  getPublishedResourceState,
  getResourceTypeFromIri,
} from '#cwa/resources/resource-utils'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { useCwa } from '#cwa/composables/cwa'
import { useCloneMode } from '#cwa/admin/clone-mode'
import { componentGroupCapacity } from '#cwa/resources/component-group-capacity'
import type { ButtonOption, ModelValue } from '#cwa/templates/components/ui/form/Button.vue'

const props = defineProps<{
  currentIri: string
  resource: CwaResource
}>()

const $cwa = useCwa()

const publishing = ref(false)

const publishedState = computed(() => {
  if (!props.currentIri || !props.resource) {
    return
  }
  return getPublishedResourceState({ data: props.resource })
})

const resourceType = computed(() => {
  return props.currentIri ? getResourceTypeFromIri(props.currentIri) : undefined
})

const buttonLabel = computed<'Publish' | undefined>(() => {
  if (publishedState.value !== false) {
    return
  }
  return 'Publish'
})

const targetGroupIri = computed(() => {
  if (resourceType.value === CwaResourceTypes.COMPONENT_GROUP) {
    return props.currentIri
  }
  return $cwa.admin.resourceStackManager.resourceStack.value.find(item => getResourceTypeFromIri(item.iri) === CwaResourceTypes.COMPONENT_GROUP)?.iri
})

const targetGroupFull = computed(() => {
  if (!targetGroupIri.value) {
    return false
  }
  return componentGroupCapacity($cwa.resources.getResource(targetGroupIri.value).value?.data).full
})

const isPersistedComponent = computed(() => {
  return resourceType.value === CwaResourceTypes.COMPONENT && props.resource?._metadata?.persisted !== false
})

const movablePositionIri = computed(() => {
  if (!isPersistedComponent.value) {
    return
  }
  const positionIri = $cwa.admin.resourceStackManager.resourceStack.value.find(item => getResourceTypeFromIri(item.iri) === CwaResourceTypes.COMPONENT_POSITION)?.iri
  const position = positionIri ? $cwa.resources.getResource(positionIri).value?.data : undefined
  if (!positionIri || position?.pageDataProperty || position?._metadata?.isDynamicPosition) {
    return
  }
  return positionIri
})

const buttonOptions = computed(() => {
  const ops: (ButtonOption | ButtonOption[])[] = []

  if (!targetGroupFull.value) {
    if (resourceType.value === CwaResourceTypes.COMPONENT_POSITION || resourceType.value === CwaResourceTypes.COMPONENT) {
      ops.push([
        {
          label: 'Add Before',
          value: 'add-before',
        },
        {
          label: 'Add After',
          value: 'add-after',
        },
      ])
    }
    else if (resourceType.value === CwaResourceTypes.COMPONENT_GROUP) {
      ops.push([
        {
          label: 'Add to Start',
          value: 'add-before',
        },
        {
          label: 'Add to End',
          value: 'add-after',
        },
      ])
    }
  }

  if (isPersistedComponent.value) {
    ops.push({ label: 'Clone', value: 'clone', testId: 'component-menu-clone' })
  }
  if (movablePositionIri.value) {
    ops.push({ label: 'Move', value: 'move', testId: 'component-menu-move' })
  }

  return ops
})

async function publishResource() {
  publishing.value = true
  await $cwa.resourcesManager.updateResource({
    endpoint: props.currentIri,
    data: {
      publishedAt: 'now',
    },
  })
  publishing.value = false
}

function handleManagerCtaClick(value?: ModelValue) {
  if (!value) {
    buttonLabel.value === 'Publish' && publishResource()
    return
  }

  if (typeof value === 'string') {
    if (['add-before', 'add-after'].includes(value)) {
      const addAfter = value === 'add-after'
      $cwa.resourcesManager.initAddResource(props.currentIri, addAfter, $cwa.admin.resourceStackManager.resourceStack.value)
    }

    if (value === 'clone') {
      useCloneMode($cwa).start(props.currentIri, $cwa.admin.resourceStackManager.currentStackItem.value?.displayName)
      $cwa.admin.emptyStack()
    }

    if (value === 'move' && movablePositionIri.value) {
      useCloneMode($cwa).start(props.currentIri, $cwa.admin.resourceStackManager.currentStackItem.value?.displayName, {
        positionIri: movablePositionIri.value,
        fromLayout: $cwa.admin.resourceStackManager.isEditingLayout.value,
      })
      $cwa.admin.emptyStack()
    }
  }
}
</script>

<template>
  <CwaUiFormButton
    color="grey"
    button-class="cwa:min-w-[100px]"
    data-testid="component-menu"
    :options="buttonOptions"
    :disabled="publishing"
    @click="handleManagerCtaClick"
  >
    {{ buttonLabel }}
  </CwaUiFormButton>
</template>

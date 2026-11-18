<script lang="ts" setup>
import { computed, toRef } from 'vue'
import {
  CwaResourceTypes,
  getResourceTypeFromIri,
} from '#cwa/resources/resource-utils'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { useCwa } from '#cwa/composables/cwa'
import { excerptOf, useCloneMode } from '#cwa/admin/clone-mode'
import type { MoveFrom } from '#cwa/admin/clone-mode'
import { componentGroupCapacity } from '#cwa/resources/component-group-capacity'
import { usePublishState } from '#cwa/admin/publish-state'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import type { MenuEntry, MenuItem } from '#cwa/templates/components/core/ui/menu-entries'

const props = defineProps<{
  currentIri: string
  resource: CwaResource
}>()

const $cwa = useCwa()

const publish = usePublishState($cwa, toRef(props, 'currentIri'), toRef(props, 'resource'))

const resourceType = computed(() => {
  return props.currentIri ? getResourceTypeFromIri(props.currentIri) : undefined
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

const closestPositionIri = computed(() => {
  return $cwa.admin.resourceStackManager.resourceStack.value.find(item => getResourceTypeFromIri(item.iri) === CwaResourceTypes.COMPONENT_POSITION)?.iri
})

const moveFrom = computed<MoveFrom | undefined>(() => {
  const positionIri = closestPositionIri.value
  if (!isPersistedComponent.value || !positionIri) {
    return
  }
  const position = $cwa.resources.getResource(positionIri).value?.data
  const property: string | undefined = position?.pageDataProperty
  if (!property) {
    return position?._metadata?.isDynamicPosition ? undefined : { componentPosition: positionIri }
  }
  const pageData = $cwa.resources.pageDataIriOf(positionIri).value
  const held = pageData ? $cwa.resources.getResource(pageData).value?.data?.[property] : undefined
  if (!pageData || !held || !$cwa.resources.findAllPublishableIris(props.currentIri).includes(held)) {
    return
  }
  return { pageData, property }
})

const groupName = computed(() => {
  const group = targetGroupIri.value ? $cwa.resources.getResource(targetGroupIri.value).value?.data : undefined
  return group?.reference || 'This group'
})

function capacityReason() {
  const group = targetGroupIri.value ? $cwa.resources.getResource(targetGroupIri.value).value?.data : undefined
  const { count, max } = componentGroupCapacity(group)
  return `${groupName.value} is full: ${count} of ${max} components.`
}

const buttonOptions = computed<MenuEntry[]>(() => {
  const ops: MenuEntry[] = []

  if (publish.scheduledAt.value) {
    ops.push({ group: null, items: [{ label: 'Cancel schedule', value: 'cancel-schedule' }] })
  }

  const addsNext = resourceType.value === CwaResourceTypes.COMPONENT_POSITION || resourceType.value === CwaResourceTypes.COMPONENT
  const addsInGroup = resourceType.value === CwaResourceTypes.COMPONENT_GROUP
  if (addsNext || addsInGroup) {
    ops.push({
      group: null,
      items: targetGroupFull.value
        ? [{ label: addsNext ? 'Add before or after' : 'Add to start or end', value: 'add-full', disabled: true, disabledReason: capacityReason() }]
        : addsNext
          ? [{ label: 'Add before', value: 'add-before' }, { label: 'Add after', value: 'add-after' }]
          : [{ label: 'Add to start', value: 'add-before' }, { label: 'Add to end', value: 'add-after' }],
    })
  }

  const more: MenuItem[] = []
  if (isPersistedComponent.value) {
    more.push({ label: 'Clone', value: 'clone', testId: 'component-menu-clone' })
  }
  if (moveFrom.value) {
    more.push({ label: 'Move', value: 'move', testId: 'component-menu-move' })
  }
  more.length && ops.push({ group: null, items: more })

  return ops
})

function handleManagerCtaClick() {
  publish.run()
}

function handleOption({ value }: MenuItem) {
  if (value === 'cancel-schedule') {
    publish.cancelSchedule()
    return
  }

  if (value === 'add-before' || value === 'add-after') {
    $cwa.resourcesManager.initAddResource(props.currentIri, value === 'add-after', $cwa.admin.resourceStackManager.resourceStack.value)
    return
  }

  const stackItem = $cwa.admin.resourceStackManager.currentStackItem.value
  const origin = { positionIri: closestPositionIri.value, excerpt: excerptOf(stackItem?.domElements.value ?? []) }

  if (value === 'clone') {
    useCloneMode($cwa).start(props.currentIri, stackItem?.displayName, undefined, origin)
    $cwa.admin.emptyStack()
  }

  if (value === 'move' && moveFrom.value && closestPositionIri.value) {
    useCloneMode($cwa).start(props.currentIri, stackItem?.displayName, {
      positionIri: closestPositionIri.value,
      fromLayout: $cwa.admin.resourceStackManager.isEditingLayout.value,
      from: moveFrom.value,
    }, origin)
    $cwa.admin.emptyStack()
  }
}
</script>

<template>
  <CwaUiButton
    v-if="publish.action.value || buttonOptions.length"
    :label="publish.action.value"
    variant="solid"
    size="sm"
    stretch
    data-testid="component-menu"
    :options="buttonOptions"
    :loading="publish.saving.value"
    :disabled="publish.action.value === 'Schedule' && !publish.scheduleValue.value"
    disabled-reason="Choose a date first"
    @click="handleManagerCtaClick"
    @select="handleOption"
  />
</template>

<script lang="ts" setup>
import { CwaResourceTypes, getPublishedResourceState, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { computed, ref, watch } from 'vue'
import { useNuxtApp } from '#app/nuxt'
import { useCwaResourceManagerTab } from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import { fetchComponentUsage } from '#cwa/admin/component-usage'
import type { ComponentUsage } from '#cwa/admin/component-usage'
import type { CwaConfirmLine } from '#cwa/composables/cwa-confirm'
import CwaUiBadge from '#cwa/templates/components/ui/Badge.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import CwaUiInput from '#cwa/templates/components/ui/Input.vue'
import CwaUiManagerRowDivider from '#cwa/templates/components/ui/ManagerRowDivider.vue'
import CwaUiManagerTab from '#cwa/templates/components/ui/ManagerTab.vue'

const { exposeMeta, iri, $cwa, resource } = useCwaResourceManagerTab({
  name: 'Info',
  order: DEFAULT_TAB_ORDER + 1,
})

defineExpose(exposeMeta)

const { vueApp } = useNuxtApp()
const disableButton = ref(false)
const usage = ref<ComponentUsage>()

const isPersistedComponent = computed(() => !!iri.value
  && getResourceTypeFromIri(iri.value) === CwaResourceTypes.COMPONENT
  && resource.value?.data?._metadata?.persisted !== false)

watch([iri, isPersistedComponent], async ([currentIri, persisted]) => {
  usage.value = undefined
  if (!currentIri || !persisted) {
    return
  }
  const fetched = await fetchComponentUsage($cwa, currentIri)
  if (iri.value === currentIri) {
    usage.value = fetched
  }
}, { immediate: true })

type DeleteChoice = 'here' | 'draft' | 'all'
type DraftState = 'live' | 'never' | undefined

function deleteLines(total: number, here: boolean, draft: DraftState): CwaConfirmLine[] {
  const shared = total > 1
  const others = total - 1
  const lines: string[] = []
  if (here) {
    lines.push(`Remove from here takes it off this location only. It stays in the other ${others === 1 ? 'place' : `${others} places`}.`)
  }
  if (draft === 'live') {
    lines.push(
      'Delete draft discards the unpublished changes. The live version stays.',
      `Delete entire component deletes the draft and the live version${shared ? ` from all ${total} places it is used` : ''}.`,
    )
  }
  else if (draft === 'never') {
    lines.push(`Delete draft deletes ${shared ? `it from all ${total} places` : 'the component'}, as there is no live version to keep.`)
  }
  else {
    lines.push(`Delete from all ${total} places deletes it everywhere it is used.`)
  }
  const undo = draft === 'live'
    ? (here ? 'Neither delete can be undone.' : 'Neither can be undone.')
    : (here ? 'Deleting can\'t be undone.' : 'This can\'t be undone.')
  return [...lines.map(text => ({ text })), { text: undo, emphasis: 'strong' }]
}

async function chooseDelete(componentIri: string, total: number, here: boolean, draft: DraftState): Promise<DeleteChoice | undefined> {
  const { confirmChoice, editingNotice } = await import('#cwa/admin/resource-confirm')
  const notice = await editingNotice($cwa, componentIri)
  const shared = total > 1
  const choices = [...(here ? ['here' as const] : []), ...(draft === 'live' ? ['draft' as const] : [])]
  const labels: Record<'here' | 'draft', string> = { here: 'Remove from here', draft: 'Delete draft' }
  const state = draft === 'live' ? 'has unpublished changes' : draft === 'never' ? 'has never been published' : undefined
  const choice = await confirmChoice(vueApp, {
    title: 'Delete this component?',
    description: shared ? `It is used in ${total} places${state ? ` and ${state}` : ''}.` : `It ${state}.`,
    keep: 'Cancel',
    ...(choices[0] ? { extra: labels[choices[0]] } : {}),
    ...(choices[0] === 'draft' ? { extraTone: 'danger' as const } : {}),
    ...(choices[1] ? { alternative: labels[choices[1]], alternativeTone: 'danger' as const } : {}),
    go: draft === 'live' ? 'Delete entire component' : draft === 'never' ? 'Delete draft' : `Delete from all ${total} places`,
    lines: [
      ...(notice ? [{ text: notice }] : []),
      ...deleteLines(total, here, draft),
    ],
  })
  return choice === 'go' ? 'all' : choice === 'extra' ? choices[0] : choice === 'alternative' ? choices[1] : undefined
}

function removeFromLocation(positionIri: string, groupIri?: string) {
  const property: string | undefined = $cwa.resources.getResource(positionIri).value?.data?.pageDataProperty
  const pageDataIri = property ? $cwa.resources.pageDataIriOf(positionIri).value : undefined
  if (property && pageDataIri) {
    return $cwa.resourcesManager.updateResource({
      endpoint: pageDataIri,
      data: { [property]: null },
      refreshEndpoints: [positionIri],
    })
  }
  if (!groupIri) {
    return $cwa.resourcesManager.deleteResource({ endpoint: positionIri, refreshEndpoints: [] }, true)
  }
  return $cwa.resourcesManager.queueComponentGroupWrite(groupIri, () => $cwa.resourcesManager.deleteResource({
    endpoint: positionIri,
    refreshEndpoints: [groupIri],
  }, true))
}

async function deleteEverywhere(componentIri: string, liveIri: string | undefined, refreshEndpoints: string[]) {
  if (!liveIri) {
    return $cwa.resourcesManager.deleteResource({ endpoint: componentIri, refreshEndpoints }, true)
  }
  await $cwa.resourcesManager.deleteResource({ endpoint: componentIri, refreshEndpoints: [] }, true)
  if ($cwa.resources.getResource(componentIri).value?.data) {
    return false
  }
  return $cwa.resourcesManager.deleteResource({ endpoint: liveIri, refreshEndpoints }, true)
}

async function deleteSelected(componentIri: string) {
  const positionIri = $cwa.admin.resourceStackManager.getClosestStackItemByType(CwaResourceTypes.COMPONENT_POSITION)
  const total = isPersistedComponent.value ? (await fetchComponentUsage($cwa, componentIri))?.total ?? 0 : 0
  const refreshEndpoints = $cwa.resources.getRefreshEndpointsForDelete(componentIri)
  const publishedResource = resource.value?.data?.publishedResource
  const liveIri = getPublishedResourceState(resource.value ?? {}) === false && typeof publishedResource === 'string' ? publishedResource : undefined
  const here = !!positionIri && total > 1
  const draft: DraftState = liveIri ? 'live' : getPublishedResourceState(resource.value ?? {}) === false ? 'never' : undefined
  if (!here && !draft) {
    return $cwa.resourcesManager.deleteResource({ endpoint: componentIri, refreshEndpoints })
  }
  const choice = await chooseDelete(componentIri, total, here, draft)
  if (choice === 'all') {
    return deleteEverywhere(componentIri, liveIri, refreshEndpoints)
  }
  if (choice === 'draft') {
    return $cwa.resourcesManager.deleteResource({ endpoint: componentIri, refreshEndpoints }, true)
  }
  if (choice === 'here' && positionIri) {
    return removeFromLocation(positionIri, $cwa.admin.resourceStackManager.getClosestStackItemByType(CwaResourceTypes.COMPONENT_GROUP))
  }
  return false
}

async function handleDelete() {
  if (!iri.value) {
    return
  }
  if (isAddingNew.value) {
    if (await $cwa.resourcesManager.confirmDiscardAddingResource()) {
      $cwa.admin.emptyStack()
    }
    return
  }

  disableButton.value = true
  const result = await deleteSelected(iri.value)
  if (result !== false) {
    $cwa.admin.emptyStack()
  }
  disableButton.value = false
}

const isDeleteEnabled = computed(() => {
  if (!iri.value) {
    return false
  }
  if (getResourceTypeFromIri(iri.value) === CwaResourceTypes.COMPONENT_GROUP) {
    return !$cwa.admin.resourceStackManager.isComponentGroupDisabled(iri.value, resource.value?.data?.location)
  }
  if (
    isAddingNew.value
    || $cwa.admin.resourceStackManager.isEditingLayout.value
    || !$cwa.resources.isDataPage.value
  ) {
    return true
  }
  const groupIri = $cwa.admin.resourceStackManager.getClosestStackItemByType(CwaResourceTypes.COMPONENT_GROUP)
  // on a data page, not editing layout and not adding new.
  return $cwa.resources.isPageDataResource(iri.value).value || !!groupIri
})

const isAddingNew = computed(() => {
  return iri.value === NEW_RESOURCE_IRI
})

const deleteLabel = computed(() => {
  return isAddingNew.value ? 'Discard' : 'Delete'
})
</script>

<template>
  <CwaUiManagerTab>
    <CwaUiInput
      :model-value="isAddingNew ? 'New, not saved yet' : iri"
      label="ID"
      width="lg"
      readonly
      data-testid="resource-id"
    />
    <CwaUiBadge
      v-if="usage && usage.total > 1"
      data-testid="resource-usage"
    >
      Used in {{ usage.total }} locations
    </CwaUiBadge>
    <template v-if="isDeleteEnabled">
      <CwaUiManagerRowDivider />
      <span data-testid="component-delete">
        <CwaUiButton
          :label="deleteLabel"
          tone="danger"
          size="sm"
          :loading="disableButton"
          :disabled="disableButton"
          @click="handleDelete"
        />
      </span>
    </template>
  </CwaUiManagerTab>
</template>

<script lang="ts" setup>
import { CwaResourceTypes, getPublishedResourceState, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { computed, ref, watch } from 'vue'
import { useNuxtApp } from '#app/nuxt'
import { useCwaResourceManagerTab } from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import { fetchComponentUsage } from '#cwa/admin/component-usage'
import type { ComponentUsage } from '#cwa/admin/component-usage'
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

async function chooseDelete(componentIri: string, total: number, here: boolean, draft: boolean): Promise<DeleteChoice | undefined> {
  const { confirmChoice, editingNotice } = await import('#cwa/admin/resource-confirm')
  const notice = await editingNotice($cwa, componentIri)
  const shared = total > 1
  const choices = [...(here ? ['here' as const] : []), ...(draft ? ['draft' as const] : [])]
  const labels: Record<'here' | 'draft', string> = { here: 'Remove from here', draft: 'Discard unpublished changes' }
  const said = [shared ? `It is used in ${total} places` : undefined, draft ? 'has unpublished changes' : undefined].filter(Boolean)
  const choice = await confirmChoice(vueApp, {
    title: 'Delete this component?',
    description: `${shared ? said.join(' and ') : 'It has unpublished changes'}.`,
    keep: 'Don\'t delete',
    extra: labels[choices[0]!],
    ...(choices[1] ? { alternative: labels[choices[1]] } : {}),
    go: shared ? `Delete from all ${total} places` : 'Delete',
    lines: [
      ...(notice ? [{ text: notice }] : []),
      ...(draft ? [{ text: 'Discarding the unpublished changes keeps the live version.', emphasis: 'muted' as const }] : []),
      { text: shared ? 'Deleting it from all places can\'t be undone.' : 'Deleting it can\'t be undone.', emphasis: 'muted' as const },
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
  if (!here && !liveIri) {
    return $cwa.resourcesManager.deleteResource({ endpoint: componentIri, refreshEndpoints })
  }
  const choice = await chooseDelete(componentIri, total, here, !!liveIri)
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

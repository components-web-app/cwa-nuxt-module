<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'
import { getPublishedResourceState } from '#cwa/runtime/resources/resource-utils'

const { exposeMeta, resource, $cwa, iri } = useCwaResourceManagerTab({
  name: 'Publish',
  order: DEFAULT_TAB_ORDER
})

const publishableState = computed(() => resource.value ? getPublishedResourceState(resource.value) : undefined)

const editLiveVersion = ref<boolean>(publishableState.value || false)

const alternateIri = computed(() => {
  if (!iri.value) {
    return
  }
  if (publishableState.value) {
    return $cwa.resources.findDraftComponentIri(iri.value).value
  }
  return $cwa.resources.findPublishedComponentIri(iri.value).value
})

// todo: selecting the live version when toggled, not highlighting... why?
// todo: resetting forcePublishedVersion if the next selected item is not one of the 2 draft.published resources
watch(editLiveVersion, (isEditLive) => {
  $cwa.admin.componentManager.forcePublishedVersion.value = isEditLive
})

defineExpose(exposeMeta)
</script>

<template>
  <div>
    <CwaUtilsFormToggle v-if="alternateIri" v-model="editLiveVersion" label="Edit live version" />
    <span v-else>
      {{ editLiveVersion ? 'Live' : 'Draft' }}
    </span>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import { usePublishState } from '#cwa/admin/publish-state'
import DatePicker from '#cwa/templates/components/ui/DatePicker.vue'
import CwaUiManagerTab from '#cwa/templates/components/ui/ManagerTab.vue'
import CwaUiManagerRowDivider from '#cwa/templates/components/ui/ManagerRowDivider.vue'
import CwaUiToggle from '#cwa/templates/components/ui/Toggle.vue'

const { exposeMeta, $cwa, iri } = useCwaResourceManagerTab({
  name: 'Publish',
  order: DEFAULT_TAB_ORDER,
})

const { published: publishableState, scheduling, scheduleValue } = usePublishState($cwa, iri)

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
  $cwa.admin.resourceStackManager.forcePublishedVersion.value = isEditLive
})
watch(iri, () => {
  editLiveVersion.value = publishableState.value || false
})

const minSchedule = new Date().toISOString()

defineExpose(exposeMeta)
</script>

<template>
  <CwaUiManagerTab>
    <CwaUiToggle
      v-if="alternateIri"
      v-model="editLiveVersion"
      label="Edit published version"
      info="Changes to the published version go live immediately."
    />
    <CwaUiManagerRowDivider v-if="alternateIri && publishableState === false" />
    <template v-if="publishableState === false">
      <CwaUiToggle
        v-model="scheduling"
        data-schedule-toggle
        label="Schedule"
      />
      <DatePicker
        v-if="scheduling"
        v-model="scheduleValue"
        :min="minSchedule"
        label="Go live"
      />
    </template>
    <span
      v-else-if="publishableState && !alternateIri"
      class="cwa:whitespace-nowrap cwa:text-label cwa:text-fg-muted"
    >Live. There is no draft to publish.</span>
  </CwaUiManagerTab>
</template>

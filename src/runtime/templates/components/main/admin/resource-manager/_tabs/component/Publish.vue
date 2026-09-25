<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import { getPublishedResourceState } from '#cwa/resources/resource-utils'
import DatePicker from '#cwa/templates/components/ui/DatePicker.vue'

const { exposeMeta, resource, $cwa, iri } = useCwaResourceManagerTab({
  name: 'Publish',
  order: DEFAULT_TAB_ORDER,
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
  $cwa.admin.resourceStackManager.forcePublishedVersion.value = isEditLive
})
watch(iri, () => {
  editLiveVersion.value = publishableState.value || false
})

const scheduledAt = computed<string | undefined>(() => {
  const publishedAt = resource.value?.data?.publishedAt
  if (publishableState.value !== false || !publishedAt) {
    return
  }
  return new Date(publishedAt).getTime() > Date.now() ? publishedAt : undefined
})
const publishStateLabel = computed(() => {
  if (publishableState.value !== false) {
    return 'Live'
  }
  return scheduledAt.value ? 'Scheduled' : 'Draft'
})
const scheduleValue = ref<string | null>(scheduledAt.value ?? null)
const minSchedule = new Date().toISOString()
const saving = ref(false)

watch(scheduledAt, (value) => {
  scheduleValue.value = value ?? null
})

async function savePublishedAt(publishedAt: string | null) {
  if (!iri.value) {
    return
  }
  saving.value = true
  try {
    await $cwa.resourcesManager.updateResource({
      endpoint: iri.value,
      data: { publishedAt },
    })
  }
  finally {
    saving.value = false
  }
}

function schedule() {
  const chosen = scheduleValue.value
  if (!chosen) {
    return
  }
  const now = new Date()
  return savePublishedAt(new Date(chosen).getTime() > now.getTime() ? chosen : now.toISOString())
}

function cancelSchedule() {
  return savePublishedAt(null)
}

defineExpose(exposeMeta)
</script>

<template>
  <div class="cwa:flex cwa:items-center cwa:gap-x-6">
    <CwaUiFormToggle
      v-if="alternateIri"
      v-model="editLiveVersion"
      label="Edit live version"
    />
    <span data-publish-state>{{ publishStateLabel }}</span>
    <template v-if="publishableState === false">
      <CwaUiFormLabelWrapper label="Publish at:">
        <DatePicker
          v-model="scheduleValue"
          :min="minSchedule"
        />
      </CwaUiFormLabelWrapper>
      <div class="cwa:flex cwa:gap-x-2">
        <CwaUiFormButton
          :disabled="saving || !scheduleValue"
          @click="schedule"
        >
          Schedule
        </CwaUiFormButton>
        <CwaUiFormButton
          v-if="scheduledAt"
          :disabled="saving"
          @click="cancelSchedule"
        >
          Cancel schedule
        </CwaUiFormButton>
      </div>
    </template>
  </div>
</template>

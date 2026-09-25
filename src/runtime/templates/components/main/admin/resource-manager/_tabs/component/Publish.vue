<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import { getPublishedResourceState } from '#cwa/resources/resource-utils'
import { dateTimeZoneLabel, formatDateTime, fromDateTimeInput, toDateTimeInput } from '#cwa/resources/date-time-input'
import ModalInput from '#cwa/templates/components/core/admin/form/ModalInput.vue'

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
const scheduledAtLabel = computed(() => formatDateTime(scheduledAt.value))
const scheduleInput = ref(toDateTimeInput(scheduledAt.value))
const minScheduleInput = toDateTimeInput(new Date().toISOString())
const timeZone = dateTimeZoneLabel()
const saving = ref(false)

watch(scheduledAt, (value) => {
  scheduleInput.value = toDateTimeInput(value)
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
  const chosen = fromDateTimeInput(scheduleInput.value)
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
  <div>
    <CwaUiFormToggle
      v-if="alternateIri"
      v-model="editLiveVersion"
      label="Edit live version"
    />
    <span v-else>
      {{ publishableState === false ? 'Draft' : 'Live' }}
    </span>
    <div
      v-if="publishableState === false"
      class="cwa:flex cwa:flex-col cwa:gap-y-2 cwa:mt-4"
    >
      <p
        v-if="scheduledAt"
        data-scheduled-at
      >
        Scheduled for {{ scheduledAtLabel }}
      </p>
      <ModalInput
        v-model="scheduleInput"
        label="Publish at"
        type="datetime-local"
        :min="minScheduleInput"
      />
      <p class="cwa:text-xs cwa:text-stone-300">
        Times are in {{ timeZone }}.
      </p>
      <div class="cwa:flex cwa:gap-x-2">
        <CwaUiFormButton
          :disabled="saving || !scheduleInput"
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
    </div>
  </div>
</template>

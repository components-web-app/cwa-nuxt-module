<script lang="ts" setup>
import { computed } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import { componentGroupCapacity } from '#cwa/resources/component-group-capacity'

const { exposeMeta, iri, resource, $cwa } = useCwaResourceManagerTab({
  name: 'Group',
  order: DEFAULT_TAB_ORDER,
})

defineExpose(exposeMeta)

const capacity = computed(() => componentGroupCapacity(resource.value?.data))

const fullReason = computed(() => {
  const { full, max } = capacity.value
  if (!full) {
    return undefined
  }
  return `This group holds at most ${max} ${max === 1 ? 'component' : 'components'}`
})

function addComponent(addAfter: boolean) {
  if (!iri.value || capacity.value.full) {
    return
  }
  $cwa.resourcesManager.initAddResource(iri.value, addAfter, $cwa.admin.resourceStackManager.resourceStack.value)
}
function addStart() {
  addComponent(false)
}
function addEnd() {
  addComponent(true)
}
</script>

<template>
  <div class="cwa:flex cwa:gap-x-4 cwa:items-center">
    <span
      data-testid="group-full"
      class="cwa:flex cwa:gap-x-4"
      :title="fullReason"
    >
      <CwaUiFormButton
        :disabled="capacity.full"
        @click="addStart"
      >
        Add to start
      </CwaUiFormButton>
      <CwaUiFormButton
        :disabled="capacity.full"
        @click="addEnd"
      >
        Add to end
      </CwaUiFormButton>
    </span>
    <span
      v-if="capacity.over"
      data-testid="group-over-limit"
      class="cwa:text-sm cwa:text-orange"
    >Holds {{ capacity.count }} of {{ capacity.max }}. Remove components to add more.</span>
  </div>
</template>

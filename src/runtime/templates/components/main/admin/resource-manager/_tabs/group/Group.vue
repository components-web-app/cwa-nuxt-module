<script lang="ts" setup>
import { computed } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import { componentGroupCapacity } from '#cwa/resources/component-group-capacity'
import CwaUiBadge from '#cwa/templates/components/ui/Badge.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import CwaUiManagerTab from '#cwa/templates/components/ui/ManagerTab.vue'

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
  <CwaUiManagerTab>
    <CwaUiButton
      label="Add to start"
      data-testid="group-add-start"
      :disabled="capacity.full"
      :disabled-reason="fullReason"
      @click="addStart"
    />
    <CwaUiButton
      label="Add to end"
      data-testid="group-add-end"
      :disabled="capacity.full"
      :disabled-reason="fullReason"
      @click="addEnd"
    />
    <CwaUiBadge
      v-if="capacity.over"
      tone="warning"
      data-testid="group-over-limit"
    >
      Holds {{ capacity.count }} of {{ capacity.max }}. Remove components to add more.
    </CwaUiBadge>
  </CwaUiManagerTab>
</template>

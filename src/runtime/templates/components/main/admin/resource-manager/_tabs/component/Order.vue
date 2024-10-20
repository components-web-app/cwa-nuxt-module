<script lang="ts" setup>
import { computed } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'
import { CwaResourceTypes } from '#cwa/runtime/resources/resource-utils'

const { exposeMeta, createComputedState, $cwa } = useCwaResourceManagerTab({
  name: 'Order',
  order: DEFAULT_TAB_ORDER,
})

defineExpose(exposeMeta)
const reordering = createComputedState<boolean>('reordering', false)

const positionIri = $cwa.admin.resourceStackManager.getClosestStackItemByType(CwaResourceTypes.COMPONENT_POSITION)

const orderValue = computed({
  get() {
    if (!positionIri) {
      return 0
    }
    return $cwa.resources.getPositionSortDisplayNumber(positionIri) || 0
  },
  set(newValue: number) {
    if (!positionIri) {
      return
    }
    $cwa.admin.eventBus.emit('reorder', {
      positionIri,
      location: newValue,
    })
  },
})

function movePosition(location: 'next' | 'previous') {
  if (!positionIri) {
    return
  }
  $cwa.admin.eventBus.emit('reorder', {
    positionIri,
    location,
  })
}

function moveUp() {
  movePosition('previous')
}
function moveDown() {
  movePosition('next')
}
</script>

<template>
  <div>
    <div class="cwa-flex cwa-space-x-4">
      <CwaUiFormToggle
        v-model="reordering"
        label="Enable reordering"
      />
      <div
        class="cwa-flex cwa-space-x-4"
        :class="{ 'cwa-pointer-events-none cwa-opacity-30': !reordering || $cwa.resourcesManager.requestCount.value }"
      >
        <div class="cwa-max-w-[100px]">
          <CwaUiFormInput
            v-model="orderValue"
            type="number"
          />
        </div>
        <div class="cwa-flex cwa-space-x-2">
          <CwaUiFormButton @click="moveUp">
            Move Up
          </CwaUiFormButton>
          <CwaUiFormButton @click="moveDown">
            Move Down
          </CwaUiFormButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'
import { CwaResourceTypes } from '#cwa/runtime/resources/resource-utils'

const { exposeMeta, createComputedState, $cwa } = useCwaResourceManagerTab({
  name: 'Order',
  order: DEFAULT_TAB_ORDER
})

defineExpose(exposeMeta)
const reordering = createComputedState<boolean>('reordering', false)

const positionIri = $cwa.admin.resourceStackManager.getClosestStackItemByType(CwaResourceTypes.COMPONENT_POSITION)
const position = positionIri ? $cwa.resources.getResource(positionIri) : undefined
const storeOrderValue = computed(() => position?.value?.data?.sortValue)
const orderValue = ref(storeOrderValue.value || 0)
watch(orderValue, (newValue) => {
  if (!positionIri) {
    return
  }
  $cwa.admin.eventBus.emit('reorder', {
    positionIri,
    location: newValue
  })
})

function movePosition (location: 'next'|'previous') {
  if (!positionIri) {
    return
  }
  $cwa.admin.eventBus.emit('reorder', {
    positionIri,
    location
  })
}

function moveUp () {
  movePosition('previous')
}
function moveDown () {
  movePosition('next')
}
</script>

<template>
  <div>
    <div class="cwa-flex cwa-space-x-4">
      <CwaUiFormToggle v-model="reordering" label="Enable reordering" />
      <div class="cwa-flex cwa-space-x-4" :class="{ 'cwa-pointer-events-none cwa-opacity-30': !reordering }">
        <div class="cwa-max-w-[100px]">
          <CwaUiFormInput v-model="orderValue" />
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

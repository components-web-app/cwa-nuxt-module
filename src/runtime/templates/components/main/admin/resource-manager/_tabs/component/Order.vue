<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import { CwaResourceTypes } from '#cwa/resources/resource-utils'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'
import CwaUiManagerTab from '#cwa/templates/components/ui/ManagerTab.vue'
import CwaUiNumber from '#cwa/templates/components/ui/Number.vue'
import CwaUiToggle from '#cwa/templates/components/ui/Toggle.vue'

const { exposeMeta, createComputedState, $cwa } = useCwaResourceManagerTab({
  name: 'Order',
  order: DEFAULT_TAB_ORDER,
})

defineExpose(exposeMeta)
const reordering = createComputedState<boolean>('reordering', false)

const stack = $cwa.admin.resourceStackManager
const positionIri = stack.getClosestStackItemByType(CwaResourceTypes.COMPONENT_POSITION)
const groupIri = stack.getClosestStackItemByType(CwaResourceTypes.COMPONENT_GROUP)

const positions = computed(() => groupIri ? $cwa.resources.getOrderedPositionsForGroup(groupIri)?.length ?? 0 : 0)

const orderValue = computed<number | null | undefined>({
  get() {
    if (!positionIri) {
      return 0
    }
    return $cwa.resources.getPositionSortDisplayNumber(positionIri) || 0
  },
  set(newValue) {
    if (!positionIri || typeof newValue !== 'number') {
      return
    }
    $cwa.admin.eventBus.emit('reorder', {
      positionIri,
      location: newValue,
    })
  },
})

const syncing = computed(() => !!positionIri && $cwa.resources.getResource(positionIri).value?.data?._metadata?.sortDisplayNumber !== undefined)
const savedAt = ref<number>()

watch(syncing, (isSyncing, wasSyncing) => {
  if (wasSyncing && !isSyncing) {
    savedAt.value = Date.now()
  }
})

const orderModel: ResourceModelField<number> = {
  model: orderValue,
  remoteChange: { value: undefined },
  state: computed<CwaFieldState>(() => {
    if (syncing.value) {
      return { status: 'saving', waiting: false, slow: false }
    }
    return savedAt.value ? { status: 'saved', waiting: false, slow: false, savedAt: savedAt.value } : { status: 'idle', waiting: false, slow: false }
  }),
}
</script>

<template>
  <CwaUiManagerTab>
    <CwaUiToggle
      v-model="reordering"
      label="Enable reordering"
      info="Lets you drag components on the page, and move this one by its position."
    />
    <CwaUiNumber
      :model="orderModel"
      label="Position"
      width="sm"
      :min="1"
      :max="Math.max(positions, 1)"
      noun="position"
      decrement-label="Move up"
      increment-label="Move down"
      min-reason="Already first in this group"
      max-reason="Already last in this group"
      :disabled="!reordering"
    />
  </CwaUiManagerTab>
</template>

<template>
  <CwaUiDialog
    v-if="localResourceData || isLoading || loadFailed"
    placement="right"
    :title="localResourceData?.number ?? 'Order'"
    :tabs="tabs"
    :loading="isLoading"
    :load-failed="loadFailed"
    noun="order"
    @close="$emit('close')"
    @retry="loadResource()"
  >
    <template #details>
      <CwaUiFormSection title="Order">
        <CwaUiDetailList :items="summary" />
      </CwaUiFormSection>
      <CwaUiFormSection title="Lines">
        <CwaUiDataTable
          label="Order lines"
          :columns="lineColumns"
          :rows="localResourceData?.lines ?? []"
        >
          <template #cell="{ column, value }">
            {{ column.key === 'total' ? money(value as number, localResourceData?.currency) : value }}
          </template>
        </CwaUiDataTable>
      </CwaUiFormSection>
      <CwaUiFormSection
        v-if="localResourceData?.state === 'paid'"
        title="Refund"
      >
        <CwaUiButton
          label="Refund"
          tone="danger"
          :loading="actionRunning"
          data-testid="fixture-order-refund"
          @click="refund"
        />
      </CwaUiFormSection>
    </template>
    <template #info>
      <CwaAdminResourceId :iri="localResourceData?.['@id']" />
    </template>
  </CwaUiDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCwaAdminItem } from '#imports'
import { money } from '../order-format'

const emit = defineEmits<{ close: [], reload: [] }>()

const { localResourceData, isLoading, loadFailed, loadResource, runAction, actionRunning } = useCwaAdminItem({
  createEndpoint: '/fixture/orders',
  emit,
  resourceType: 'Order',
  defaultResource: () => ({}),
})

const tabs = [{ key: 'details', label: 'Details' }, { key: 'info', label: 'Info' }]
const lineColumns = [
  { key: 'title', label: 'Item' },
  { key: 'quantity', label: 'Qty', align: 'end' as const },
  { key: 'total', label: 'Total', align: 'end' as const },
]
const summary = computed(() => [
  { label: 'State', value: localResourceData.value?.state },
  { label: 'Email', value: localResourceData.value?.customerEmail },
  { label: 'Total', value: money(localResourceData.value?.total, localResourceData.value?.currency) },
])

function refund() {
  const iri = localResourceData.value?.['@id']
  return iri && runAction({
    endpoint: `${iri}/refund`,
    confirm: { title: 'Refund this order?', go: 'Refund', tone: 'danger' },
    success: 'Order refunded',
  })
}
</script>

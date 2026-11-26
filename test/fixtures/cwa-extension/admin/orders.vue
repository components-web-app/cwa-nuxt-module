<template>
  <CwaAdminList
    title="Fixture orders"
    fetch-url="/fixture/orders"
    noun="orders"
    :columns="columns"
    :order-options="orderOptions"
    search-label="Search orders"
  >
    <template #filters>
      <CwaUiMultiSelect
        v-model="states"
        label="State"
        label-hidden
        placeholder="Any state"
        search-placeholder="Search states"
        :options="stateOptions"
        data-testid="fixture-order-states"
      />
    </template>
    <template #item="{ data, link }">
      <CwaAdminListRow
        :to="link"
        :title="data.number"
        :sub="data.customerEmail"
      >
        <CwaAdminListCell>
          <CwaUiBadge :tone="data.state === 'paid' ? 'success' : 'neutral'">
            {{ data.state }}
          </CwaUiBadge>
        </CwaAdminListCell>
        <CwaAdminListCell align="end">
          {{ money(data.total, data.currency) }}
        </CwaAdminListCell>
      </CwaAdminListRow>
    </template>
  </CwaAdminList>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { definePageMeta, useQueryBoundModel } from '#imports'
import { money } from '../order-format'

const columns = [
  { label: 'Order' },
  { label: 'State', width: '8rem' },
  { label: 'Total', width: '7rem', align: 'end' as const },
]
const orderOptions = [
  { label: 'Newest first', value: { createdAt: 'desc' } },
  { label: 'Highest total', value: { total: 'desc' } },
]
const stateOptions = ['awaiting_payment', 'paid', 'cancelled', 'refunded'].map(state => ({ label: state, value: state }))
const { model: stateModel } = useQueryBoundModel('state[]', { defaultValue: [] })
const states = computed({
  get: () => (stateModel.value ?? []) as string[],
  set: (value: string[]) => {
    stateModel.value = value
  },
})

definePageMeta({ pageTransition: false })
</script>

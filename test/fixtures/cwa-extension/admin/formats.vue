<template>
  <CwaUiFormSection title="Formats">
    <CwaUiDataTable
      label="Formats and prices"
      :columns="columns"
      :rows="data?.variants ?? []"
    >
      <template #cell="{ column, value }">
        {{ column.key === 'price' ? money(value as number) : value }}
      </template>
    </CwaUiDataTable>
  </CwaUiFormSection>
</template>

<script setup lang="ts">
import { money } from '../order-format'

defineProps<{ iri?: string, data?: Record<string, any> }>()

const columns = [
  { key: 'format', label: 'Format' },
  { key: 'price', label: 'Price', align: 'end' as const },
]
</script>

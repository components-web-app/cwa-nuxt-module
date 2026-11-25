<script setup lang="ts">
import { useId } from 'vue'

export interface DataTableColumn {
  key: string
  label: string
  align?: 'end'
}

const { columns, rows, label, empty = 'None' } = defineProps<{
  columns: DataTableColumn[]
  rows: Record<string, unknown>[]
  label: string
  empty?: string
}>()

defineSlots<{
  cell?: (props: { row: Record<string, unknown>, column: DataTableColumn, value: unknown }) => unknown
}>()

const captionId = useId()

function isEmpty(value: unknown) {
  return value === undefined || value === null || value === ''
}

function alignClasses(column: DataTableColumn) {
  return column.align === 'end' ? ['cwa:text-end', 'cwa:tabular-nums', 'cwa:whitespace-nowrap'] : ['cwa:text-start']
}
</script>

<template>
  <div
    role="group"
    tabindex="0"
    :aria-labelledby="captionId"
    data-testid="data-table"
    class="cwa:w-full cwa:min-w-0 cwa:max-w-full cwa:overflow-x-auto cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg"
  >
    <table class="cwa:w-full cwa:border-collapse cwa:text-control cwa:text-fg">
      <caption
        :id="captionId"
        class="cwa:sr-only"
      >
        {{ label }}
      </caption>
      <thead>
        <tr class="cwa:border-b cwa:border-line">
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            class="cwa:whitespace-nowrap cwa:px-2 cwa:py-2 cwa:align-bottom cwa:text-label cwa:text-fg-secondary cwa:first:ps-0 cwa:last:pe-0"
            :class="alignClasses(column)"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-if="!rows.length"
          data-testid="data-table-empty"
        >
          <td
            :colspan="columns.length || 1"
            class="cwa:py-2 cwa:text-fg-muted"
          >
            {{ empty }}
          </td>
        </tr>
        <tr
          v-for="(row, rowIndex) in rows"
          :key="rowIndex"
          data-testid="data-table-row"
          class="cwa:border-b cwa:border-line cwa:last:border-b-0"
        >
          <td
            v-for="column in columns"
            :key="column.key"
            class="cwa:px-2 cwa:py-2 cwa:align-top cwa:first:ps-0 cwa:last:pe-0"
            :class="alignClasses(column)"
          >
            <slot
              name="cell"
              :row="row"
              :column="column"
              :value="row[column.key]"
            >
              <template v-if="isEmpty(row[column.key])">
                <span aria-hidden="true">—</span>
                <span class="cwa:sr-only">Not set</span>
              </template>
              <template v-else>
                {{ row[column.key] }}
              </template>
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

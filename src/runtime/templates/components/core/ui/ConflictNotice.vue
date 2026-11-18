<script setup lang="ts">
import { useId } from 'vue'
import StateGlyph from './StateGlyph.vue'
import CwaUiButton from '../../ui/Button.vue'
import { shownValue } from './field-value'
import type { FieldValueFormat } from './field-value'
import type { RemoteFieldChange } from '#cwa/resources/model-editors'

const { change, mine, id, format } = defineProps<{
  change: RemoteFieldChange
  mine: unknown
  id: string
  format?: FieldValueFormat
}>()

const headingId = useId()

function shown(value: unknown) {
  return shownValue(value, format)
}
</script>

<template>
  <div
    :id="id"
    role="group"
    :aria-labelledby="headingId"
    data-testid="conflict-notice"
    class="cwa:mt-2 cwa:border-s-3 cwa:border-warning cwa:bg-[color-mix(in_srgb,var(--cwa-color-warning)_10%,var(--cwa-color-surface))] cwa:p-3 cwa:text-control cwa:text-fg"
  >
    <p
      :id="headingId"
      class="cwa:m-0 cwa:flex cwa:items-center cwa:gap-2 cwa:font-semibold"
    >
      <StateGlyph kind="conflict" />
      {{ change.name }} changed this while you were editing.
    </p>
    <dl class="cwa:mt-2 cwa:mb-0 cwa:grid cwa:grid-cols-[auto_minmax(0,1fr)] cwa:gap-x-3 cwa:gap-y-1">
      <dt class="cwa:text-fg-muted">
        {{ change.name }}’s
      </dt>
      <dd class="cwa:m-0 cwa:break-words">
        {{ shown(change.value) }}
      </dd>
      <dt class="cwa:text-fg-muted">
        Yours
      </dt>
      <dd class="cwa:m-0 cwa:break-words">
        {{ shown(mine) }}
      </dd>
    </dl>
    <div class="cwa:mt-3 cwa:flex cwa:flex-wrap cwa:justify-end cwa:gap-2">
      <CwaUiButton
        size="sm"
        :label="`Use ${change.name}’s`"
        data-testid="conflict-use-theirs"
        @click="change.accept()"
      />
      <CwaUiButton
        size="sm"
        label="Keep mine"
        data-testid="conflict-keep-mine"
        @click="change.keep()"
      />
    </div>
  </div>
</template>

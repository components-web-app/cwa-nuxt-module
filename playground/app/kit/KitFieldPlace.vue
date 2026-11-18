<script setup lang="ts">
import { CwaUiDialog, CwaUiFormSection, CwaUiManagerTab } from '#components'
import KitFieldRow from './KitFieldRow.vue'
import type { KitFieldKey, KitFieldSet, KitPlace } from './kit-field-set'

const { set, place, state, disabled = false, disabledReason, only, testId } = defineProps<{
  set: KitFieldSet
  place: KitPlace
  state: string
  disabled?: boolean
  disabledReason?: string
  only?: KitFieldKey[]
  testId: string
}>()

const emit = defineEmits<{ closeDialog: [] }>()
</script>

<template>
  <KitFieldRow
    v-if="place === 'page'"
    :set="set"
    :disabled="disabled"
    :disabled-reason="disabledReason"
    :only="only"
    :test-id="testId"
  />
  <figure
    v-else-if="place === 'bar'"
    class="kit-place"
  >
    <div class="kit-place-bar">
      <CwaUiManagerTab>
        <KitFieldRow
          :set="set"
          :disabled="disabled"
          :disabled-reason="disabledReason"
          :only="only"
          :test-id="testId"
          bare
        />
      </CwaUiManagerTab>
    </div>
    <figcaption><code>CwaUiManagerTab</code> holding every field type · {{ state }}</figcaption>
  </figure>
  <CwaUiDialog
    v-else
    title="Hero section"
    size="md"
    :data-testid="`${testId}-dialog`"
    @close="emit('closeDialog')"
  >
    <CwaUiFormSection
      title="Every field type"
      :description="`CwaUiDialog with fields stacked · ${state}`"
    >
      <KitFieldRow
        :set="set"
        :disabled="disabled"
        :disabled-reason="disabledReason"
        :only="only"
        :test-id="testId"
        bare
      />
    </CwaUiFormSection>
  </CwaUiDialog>
</template>

<style scoped>
.kit-place {
  display: flex;
  flex: 1 1 100%;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
  margin: 0;
}

.kit-place-bar {
  max-width: 100%;
  background: var(--cwa-color-surface);
  box-shadow: inset 0 0 0 1px var(--cwa-color-line);
}

figcaption {
  color: var(--cwa-color-fg-muted);
  font-size: 0.75rem;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--cwa-color-fg-secondary);
}
</style>

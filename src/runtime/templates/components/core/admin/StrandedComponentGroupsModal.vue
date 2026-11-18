<template>
  <CwaUiDialog
    title="Stranded component groups"
    size="lg"
    data-testid="stranded-groups-modal"
    @close="emit('close')"
  >
    <div class="cwa:flex cwa:flex-col cwa:gap-stack">
      <p class="cwa:m-0 cwa:text-control cwa:text-fg-secondary">
        These component groups are attached to this page, but no template on it declares them, so they are not shown, for example after a group's reference was renamed in code. Merge each one into a group that is shown, or delete it.
      </p>
      <p
        v-if="!groups.length"
        class="cwa:m-0 cwa:text-control cwa:text-fg-muted"
      >
        Every component group attached to this page is shown.
      </p>
      <section
        v-for="group of groups"
        :key="group.iri"
        data-testid="stranded-group"
        class="cwa:flex cwa:flex-col cwa:gap-3 cwa:border-t cwa:border-line cwa:pt-stack"
      >
        <div class="cwa:flex cwa:flex-col cwa:gap-1">
          <h3 class="cwa:m-0 cwa:break-all cwa:text-section cwa:text-fg-secondary">
            {{ group.reference }}
          </h3>
          <span class="cwa:break-all cwa:font-mono cwa:text-helper cwa:text-fg-muted">{{ group.iri }}</span>
        </div>
        <p
          v-if="!group.positions.length"
          class="cwa:m-0 cwa:text-control cwa:text-fg-muted"
        >
          This group is empty.
        </p>
        <ul
          v-else
          class="cwa:m-0 cwa:flex cwa:list-none cwa:flex-col cwa:gap-1 cwa:p-0"
        >
          <li
            v-for="position of group.positions"
            :key="position.iri"
            class="cwa:flex cwa:flex-wrap cwa:gap-x-2 cwa:text-control"
          >
            <template v-if="position.pageDataProperty">
              <span>Dynamic</span>
              <span class="cwa:font-mono cwa:text-fg-muted">{{ position.pageDataProperty }}</span>
            </template>
            <template v-else>
              <span>{{ position.componentType || 'Component' }}</span>
              <span class="cwa:break-all cwa:font-mono cwa:text-fg-muted">{{ position.component || position.iri }}</span>
            </template>
          </li>
        </ul>
        <div class="cwa:flex cwa:flex-wrap cwa:items-end cwa:gap-actions">
          <CwaUiSelect
            :model-value="selectedTargets[group.iri] ?? null"
            :options="targetOptions(group)"
            label="Merge into"
            placeholder="Choose a group…"
            width="md"
            :disabled="!group.positions.length"
            :disabled-reason="group.positions.length ? undefined : 'This group is empty.'"
            @update:model-value="selectedTargets[group.iri] = $event ?? undefined"
          />
          <CwaUiButton
            label="Merge"
            :loading="busy[group.iri]"
            :disabled="!selectedTargets[group.iri] || !group.positions.length"
            :disabled-reason="mergeReason(group)"
            @click="merge(group)"
          />
          <CwaUiButton
            label="Delete"
            tone="danger"
            :disabled="busy[group.iri]"
            @click="remove(group)"
          />
        </div>
        <div
          v-if="outcomes[group.iri]"
          data-testid="stranded-group-outcome"
        >
          <CwaUiAlert
            tone="danger"
            :title="outcomes[group.iri]!.length ? 'These components could not be moved, so the group was kept:' : 'The components were moved, but the empty group could not be deleted.'"
          >
            <ul
              v-if="outcomes[group.iri]!.length"
              class="cwa:m-0 cwa:list-none cwa:p-0"
            >
              <li
                v-for="positionIri of outcomes[group.iri]"
                :key="positionIri"
                class="cwa:break-all cwa:font-mono cwa:text-helper"
              >
                {{ positionIri }}
              </li>
            </ul>
          </CwaUiAlert>
        </div>
      </section>
    </div>
  </CwaUiDialog>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { useNuxtApp } from '#imports'
import { mergeComponentGroup } from '#cwa/admin/stranded-component-groups'
import { componentGroupCapacity } from '#cwa/resources/component-group-capacity'
import type { ShownComponentGroup, StrandedComponentGroup } from '#cwa/admin/stranded-component-groups'

const props = defineProps<{
  groups: StrandedComponentGroup[]
  targets: ShownComponentGroup[]
}>()

const emit = defineEmits<{
  close: []
}>()

const $cwa = useCwa()
const vueApp = useNuxtApp().vueApp

const selectedTargets = reactive<Record<string, string | undefined>>({})
const busy = reactive<Record<string, boolean>>({})
const outcomes = reactive<Record<string, string[] | undefined>>({})

function hasRoomFor(target: ShownComponentGroup, group: StrandedComponentGroup) {
  const { max, count } = componentGroupCapacity($cwa.resources.getResource(target.iri).value?.data)
  return max === null || count + group.positions.length <= max
}

function targetOptions(group: StrandedComponentGroup) {
  return props.targets
    .filter(target => target.iri !== group.iri && hasRoomFor(target, group))
    .map(target => ({ label: target.reference, value: target.iri }))
}

function mergeReason(group: StrandedComponentGroup) {
  if (!group.positions.length) {
    return 'This group is empty.'
  }
  return selectedTargets[group.iri] ? undefined : 'Choose a group to merge into first.'
}

async function confirmMerge(group: StrandedComponentGroup, target: ShownComponentGroup | undefined) {
  const { confirmResourceAction } = await import('#cwa/admin/resource-confirm')
  const count = group.positions.length
  return confirmResourceAction(vueApp, {
    title: 'Merge component group?',
    description: `Move the ${count} ${count === 1 ? 'component' : 'components'} in “${group.reference}” to the end of “${target?.reference ?? ''}”, then delete the empty “${group.reference}” group?`,
    keep: 'Cancel',
    go: 'Merge',
    tone: 'accent',
  })
}

async function merge(group: StrandedComponentGroup) {
  const targetIri = selectedTargets[group.iri]
  if (!targetIri || busy[group.iri]) {
    return
  }
  busy[group.iri] = true
  outcomes[group.iri] = undefined
  try {
    if (!await confirmMerge(group, props.targets.find(target => target.iri === targetIri))) {
      return
    }
    const { failed, sourceDeleted } = await mergeComponentGroup($cwa, group.iri, targetIri)
    if (failed.length || !sourceDeleted) {
      outcomes[group.iri] = failed
    }
  }
  finally {
    busy[group.iri] = false
  }
}

async function remove(group: StrandedComponentGroup) {
  if (busy[group.iri]) {
    return
  }
  busy[group.iri] = true
  outcomes[group.iri] = undefined
  try {
    await $cwa.resourcesManager.deleteResource({ endpoint: group.iri })
  }
  finally {
    busy[group.iri] = false
  }
}
</script>

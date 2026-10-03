<template>
  <div
    class="cwa:text-light cwa:w-full cwa:bg-stone-800 cwa:max-w-4xl cwa:max-h-full cwa:flex cwa:flex-col"
    data-testid="stranded-groups-modal"
  >
    <div class="cwa:bg-stone-900/40 cwa:border-b-2 cwa:border-b-orange cwa:p-3 cwa:flex cwa:items-center cwa:justify-between cwa:gap-x-4">
      <h2 class="cwa:text-2xl cwa:px-3">
        Stranded component groups
      </h2>
      <button
        class="cwa:cursor-pointer cwa:text-stone-400"
        data-testid="stranded-groups-close"
        @click="emit('close')"
      >
        <CwaUiIconXMarkIcon class="cwa:h-10" />
        <span class="cwa:sr-only">Close</span>
      </button>
    </div>
    <div class="cwa:grow cwa:px-4 cwa:pt-4 cwa:pb-10 cwa:flex cwa:justify-center cwa:min-h-0">
      <div class="cwa:w-full cwa:max-w-xl cwa:overflow-auto cwa:flex cwa:flex-col cwa:gap-y-6">
        <p class="cwa:text-sm cwa:text-stone-300">
          These component groups are attached to this page, but no template on it declares them, so they are not shown, for example after a group's reference was renamed in code. Merge each one into a group that is shown, or delete it.
        </p>
        <p
          v-if="!groups.length"
          class="cwa:text-sm cwa:text-stone-400"
        >
          Every component group attached to this page is shown.
        </p>
        <section
          v-for="group of groups"
          :key="group.iri"
          data-testid="stranded-group"
          class="cwa:border-b cwa:border-b-stone-700 cwa:pb-6 cwa:flex cwa:flex-col cwa:gap-y-3"
        >
          <div class="cwa:flex cwa:flex-col cwa:gap-y-1">
            <h3 class="cwa:text-xl cwa:break-all">
              {{ group.reference }}
            </h3>
            <span class="cwa:font-mono cwa:text-xs cwa:text-stone-400 cwa:break-all">{{ group.iri }}</span>
          </div>
          <p
            v-if="!group.positions.length"
            class="cwa:text-sm cwa:text-stone-400"
          >
            This group is empty.
          </p>
          <ul
            v-else
            class="cwa:flex cwa:flex-col cwa:gap-y-1"
          >
            <li
              v-for="position of group.positions"
              :key="position.iri"
              class="cwa:flex cwa:flex-wrap cwa:gap-x-2 cwa:text-sm"
            >
              <template v-if="position.pageDataProperty">
                <span>Dynamic</span>
                <span class="cwa:font-mono cwa:text-stone-400">{{ position.pageDataProperty }}</span>
              </template>
              <template v-else>
                <span>{{ position.componentType || 'Component' }}</span>
                <span class="cwa:font-mono cwa:text-stone-400 cwa:break-all">{{ position.component || position.iri }}</span>
              </template>
            </li>
          </ul>
          <div class="cwa:flex cwa:flex-wrap cwa:items-center cwa:gap-4">
            <CwaUiFormSelect
              :model-value="selectedTargets[group.iri]"
              :options="targetOptions(group)"
              placeholder="Merge into…"
              @update:model-value="selectedTargets[group.iri] = $event"
            />
            <CwaUiFormButton
              color="blue"
              :disabled="busy[group.iri] || !selectedTargets[group.iri] || !group.positions.length"
              @click="merge(group)"
            >
              Merge
            </CwaUiFormButton>
            <CwaUiFormButton
              color="error"
              :disabled="busy[group.iri]"
              @click="remove(group)"
            >
              Delete
            </CwaUiFormButton>
          </div>
          <div
            v-if="outcomes[group.iri]"
            data-testid="stranded-group-outcome"
            class="cwa:text-sm cwa:text-danger cwa:font-bold cwa:flex cwa:flex-col cwa:gap-y-1"
          >
            <template v-if="outcomes[group.iri]!.length">
              <p>These components could not be moved, so the group was kept:</p>
              <ul>
                <li
                  v-for="positionIri of outcomes[group.iri]"
                  :key="positionIri"
                  class="cwa:font-mono cwa:break-all"
                >
                  {{ positionIri }}
                </li>
              </ul>
            </template>
            <p v-else>
              The components were moved, but the empty group could not be deleted.
            </p>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import escape from 'lodash-es/escape'
import { createConfirmDialog } from 'vuejs-confirm-dialog'
import { useCwa } from '#cwa/composables/cwa'
import { mergeComponentGroup } from '#cwa/admin/stranded-component-groups'
import type { ShownComponentGroup, StrandedComponentGroup } from '#cwa/admin/stranded-component-groups'

const props = defineProps<{
  groups: StrandedComponentGroup[]
  targets: ShownComponentGroup[]
}>()

const emit = defineEmits<{
  close: []
}>()

const $cwa = useCwa()

const selectedTargets = reactive<Record<string, string | undefined>>({})
const busy = reactive<Record<string, boolean>>({})
const outcomes = reactive<Record<string, string[] | undefined>>({})

function targetOptions(group: StrandedComponentGroup) {
  return props.targets
    .filter(target => target.iri !== group.iri)
    .map(target => ({ label: target.reference, value: target.iri }))
}

async function confirmMerge(group: StrandedComponentGroup, target: ShownComponentGroup | undefined) {
  const { default: ConfirmDialog } = await import('#cwa/templates/components/core/ConfirmDialog.vue')
  const dialog = createConfirmDialog(ConfirmDialog as Parameters<typeof createConfirmDialog>[0])
  const count = group.positions.length
  const { isCanceled } = await dialog.reveal({
    title: 'Merge component group?',
    content: `<p>Move the ${count} ${count === 1 ? 'component' : 'components'} in “${escape(group.reference)}” to the end of “${escape(target?.reference ?? '')}”, then delete the empty “${escape(group.reference)}” group?</p>`,
  })
  return !isCanceled
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

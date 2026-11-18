<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, provide, reactive, ref, useId, useTemplateRef, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import type { RouteLocationNormalized } from 'vue-router'
import CwaUiButton from '../../ui/Button.vue'
import CwaUiAlert from '../../ui/Alert.vue'
import CheckGlyph from './CheckGlyph.vue'
import StateGlyph from './StateGlyph.vue'
import DialogPanel from './DialogPanel.vue'
import { announceKey, fieldGroupKey, formSurfaceKey, sectionHeadingKey } from './field-keys'
import { changesText, dialogTabBadge, dialogTabWords, listText } from './dialog-form'
import type { DialogForm, DialogTab } from './dialog-form'
import { useCwaConfirm } from '#cwa/composables/cwa-confirm'

const SAVED_FOR = 1500

const props = defineProps<{
  form: DialogForm
  tabs?: DialogTab[]
  tab?: string
}>()

const emit = defineEmits<{
  'save': []
  'update:tab': [key: string]
}>()

defineSlots<{
  [key: string]: (() => any) | undefined
}>()

const confirm = useCwaConfirm()
const root = useTemplateRef<HTMLElement>('root')
const alert = useTemplateRef<InstanceType<typeof CwaUiAlert>>('alert')

const tabsId = useId()
const localTab = ref(props.tab ?? props.tabs?.[0]?.key)
const currentTab = computed({
  get: () => props.tab ?? localTab.value,
  set: (key) => {
    localTab.value = key
    key && emit('update:tab', key)
  },
})

const registry = reactive(new Map<string, { label: string, tab?: string }>())

function register(field: string, label: string, tab?: string) {
  registry.set(field, { label, tab })
  return () => {
    registry.get(field)?.label === label && registry.delete(field)
  }
}

function isUnsaved(field: string) {
  return props.form.unsavedFields.includes(field)
}

function noClaim() {
  return () => undefined
}

function fieldsOf(tab: string) {
  return [...registry.entries()].filter(([, entry]) => entry.tab === tab).map(([field]) => field)
}

const badges = computed(() => Object.fromEntries((props.tabs ?? []).map(tab => [tab.key, dialogTabBadge(fieldsOf(tab.key), props.form)])))

function glyphOf(key: string) {
  const kind = badges.value[key]?.kind
  return kind === 'conflict' || kind === 'error' ? kind : undefined
}

function tabLabelOf(field: string) {
  const tab = registry.get(field)?.tab
  return props.tabs?.find(candidate => candidate.key === tab)?.label
}

function onTabKey(event: KeyboardEvent, index: number) {
  const tabs = props.tabs ?? []
  const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }
  if (!(event.key in moves) || event.altKey || event.metaKey || event.ctrlKey) {
    return
  }
  event.preventDefault()
  currentTab.value = tabs[(moves[event.key]! + tabs.length) % tabs.length]!.key
  nextTick(() => document.getElementById(`${tabsId}-${currentTab.value}`)?.focus())
}

provide(announceKey, text => announce(text))
provide(formSurfaceKey, { unsaved: isUnsaved, register: (field, label) => register(field, label) })
provide(fieldGroupKey, { model: field => props.form.model(field), undo: () => undefined })
provide(sectionHeadingKey, 'h2')

function labelOf(field: string) {
  return registry.get(field)?.label ?? field
}

const unsavedCount = computed(() => props.form.unsavedFields.length)
const errorFields = computed(() => Object.keys(props.form.fieldErrors))
const conflictFields = computed(() => Object.keys(props.form.conflicts))

const now = ref(Date.now())
let savedTimer: ReturnType<typeof setTimeout> | undefined
watch(() => props.form.savedAt, (savedAt) => {
  clearTimeout(savedTimer)
  now.value = Date.now()
  if (savedAt && savedAt + SAVED_FOR > now.value) {
    savedTimer = setTimeout(() => {
      now.value = Date.now()
    }, savedAt + SAVED_FOR - now.value)
  }
}, { immediate: true })
const justSaved = computed(() => !!props.form.savedAt && props.form.savedAt + SAVED_FOR > now.value && !unsavedCount.value)

const blockedText = computed(() => {
  if (conflictFields.value.length) {
    const n = conflictFields.value.length
    return `Choose ${n} ${n === 1 ? 'version' : 'versions'} to save`
  }
  return errorFields.value.length ? `${errorFields.value.length} to fix` : undefined
})

const saveLabel = computed(() => {
  if (props.form.saving) {
    return 'Saving…'
  }
  if (justSaved.value) {
    return 'Saved'
  }
  return unsavedCount.value ? `Save ${changesText(unsavedCount.value)}` : 'Save'
})

const saveName = computed(() => unsavedCount.value && !props.form.saving ? `Save ${unsavedText(unsavedCount.value)}` : undefined)
const saveDisabled = computed(() => !unsavedCount.value || !!conflictFields.value.length)
const saveReason = computed(() => conflictFields.value.length ? blockedText.value : unsavedCount.value ? undefined : 'Nothing has changed.')

const showAlert = ref(false)
const announcement = ref('')

function announce(text: string) {
  announcement.value = ''
  nextTick(() => {
    announcement.value = text
  })
}

const alertTitle = computed(() => {
  if (conflictFields.value.length) {
    const n = conflictFields.value.length
    const names = [...new Set(conflictFields.value.map(field => props.form.conflicts[field]?.name))].filter(Boolean) as string[]
    return `${n} ${n === 1 ? 'field' : 'fields'} changed by ${listText(names)} while you were editing.`
  }
  if (errorFields.value.length) {
    const n = errorFields.value.length
    return `Your changes weren't saved. ${n} ${n === 1 ? 'field needs' : 'fields need'} a change.`
  }
  return 'Your changes weren\'t saved.'
})

const alertFields = computed(() => conflictFields.value.length ? conflictFields.value : errorFields.value)
const hasIssue = computed(() => !!(conflictFields.value.length || errorFields.value.length || props.form.formError))

watch(hasIssue, (issue) => {
  if (!issue) {
    showAlert.value = false
  }
})

watch(() => props.form.failures, async (failures, previous) => {
  if (!failures || failures === previous) {
    return
  }
  showAlert.value = true
  const failed = alertFields.value
  if (failed.length && !failed.some(field => registry.get(field)?.tab === currentTab.value)) {
    const first = props.tabs?.find(tab => failed.some(field => registry.get(field)?.tab === tab.key))
    first && (currentTab.value = first.key)
  }
  announce(alertTitle.value)
  await nextTick()
  alert.value?.focus()
})

async function showField(field: string) {
  const tab = registry.get(field)?.tab
  tab && (currentTab.value = tab)
  await nextTick()
  root.value?.querySelector<HTMLElement>(`[data-cwa-field="${CSS.escape(field)}"] :is(input, textarea, button, [tabindex]:not([tabindex="-1"]))`)?.focus()
}

let asking: Promise<boolean> | undefined

function ask(title: string, description: string, go: string) {
  asking ??= confirm({ title, description, keep: 'Keep editing', go }).finally(() => {
    asking = undefined
  })
  return asking
}

function unsavedNames() {
  return props.form.unsavedFields.map(labelOf)
}

function unsavedText(count: number) {
  return `${count} unsaved ${count === 1 ? 'change' : 'changes'}`
}

async function cancel() {
  const names = unsavedNames()
  if (!names.length) {
    return
  }
  if (await ask(`Discard ${unsavedText(names.length)}?`, `Your changes to ${listText(names)} will be lost.`, 'Discard')) {
    props.form.discard()
  }
}

const router = useRouter()
let approvedLeave: string | undefined

function leaveKey(to: RouteLocationNormalized) {
  const { cwa_force: _force, ...query } = to.query
  return router.resolve({ path: to.path, query, hash: to.hash }).fullPath
}

onBeforeRouteLeave(async (to) => {
  const names = unsavedNames()
  const key = leaveKey(to)
  if (!names.length || approvedLeave === key) {
    return true
  }
  if (!await ask('Leave without saving?', `${unsavedText(names.length)} (${listText(names)}) will be lost.`, 'Leave')) {
    return false
  }
  approvedLeave = key
  return true
})

const stopAfterEach = router.afterEach((_to, _from, failure) => {
  if (failure) {
    approvedLeave = undefined
  }
})

function onBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault()
  event.returnValue = ''
}

watch(() => unsavedCount.value > 0, (dirty) => {
  if (typeof window === 'undefined') {
    return
  }
  if (dirty) {
    window.addEventListener('beforeunload', onBeforeUnload)
    return
  }
  window.removeEventListener('beforeunload', onBeforeUnload)
}, { immediate: true })

onBeforeUnmount(() => {
  stopAfterEach()
  clearTimeout(savedTimer)
  typeof window !== 'undefined' && window.removeEventListener('beforeunload', onBeforeUnload)
})

defineExpose({ showField, announce })
</script>

<template>
  <div
    ref="root"
    data-testid="form-group"
    class="cwa:w-full cwa:max-w-[40rem] cwa:text-fg cwa:[--cwa-spacing-control:var(--cwa-spacing-control-lg)] cwa:[--cwa-text-control:var(--cwa-text-control-lg)]"
  >
    <div
      data-testid="form-group-head"
      class="cwa:mb-section cwa:flex cwa:flex-col cwa:gap-y-3 cwa:sm:flex-row cwa:sm:items-center cwa:sm:gap-x-4"
      :class="{ 'cwa:sm:border-b cwa:sm:border-line': tabs?.length }"
    >
      <div
        v-if="tabs?.length"
        role="tablist"
        aria-label="Sections"
        class="cwa:flex cwa:h-hit cwa:min-w-0 cwa:items-stretch cwa:overflow-x-auto cwa:[scrollbar-width:none] cwa:max-sm:border-b cwa:max-sm:border-line cwa:sm:flex-1"
      >
        <button
          v-for="(item, index) in tabs"
          :id="`${tabsId}-${item.key}`"
          :key="item.key"
          type="button"
          role="tab"
          :aria-selected="currentTab === item.key ? 'true' : 'false'"
          :aria-controls="`${tabsId}-${item.key}-panel`"
          :aria-label="badges[item.key]?.kind ? `${item.label}, ${dialogTabWords(badges[item.key]!)}` : undefined"
          :title="badges[item.key]?.kind ? dialogTabWords(badges[item.key]!) : undefined"
          :tabindex="currentTab === item.key ? 0 : -1"
          :data-badge="badges[item.key]?.kind"
          :data-tab="item.key"
          data-testid="form-group-tab"
          class="cwa:relative cwa:inline-flex cwa:shrink-0 cwa:cursor-pointer cwa:items-center cwa:gap-2 cwa:whitespace-nowrap cwa:px-4 cwa:text-label cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:after:absolute cwa:after:inset-x-0 cwa:after:bottom-0 cwa:after:h-0.5 cwa:after:content-['']"
          :class="currentTab === item.key ? 'cwa:text-fg cwa:after:bg-accent' : 'cwa:text-fg-muted cwa:hover:text-fg'"
          @click="currentTab = item.key"
          @keydown="onTabKey($event, index)"
        >
          {{ item.label }}
          <StateGlyph
            v-if="glyphOf(item.key)"
            :kind="glyphOf(item.key)!"
          />
          <span
            v-else-if="badges[item.key]?.kind === 'unsaved'"
            aria-hidden="true"
            data-testid="form-group-tab-unsaved"
            class="cwa:size-2 cwa:rounded-toggle cwa:bg-accent-fg"
          />
        </button>
      </div>
      <div
        data-testid="form-group-actions"
        class="cwa:flex cwa:items-center cwa:justify-end cwa:gap-actions cwa:sm:ms-auto"
      >
        <p
          v-if="blockedText"
          data-testid="form-group-blocked"
          class="cwa:m-0 cwa:text-helper cwa:text-fg-muted cwa:max-sm:hidden"
        >
          {{ blockedText }}
        </p>
        <div class="cwa:grid cwa:grid-cols-2 cwa:gap-actions cwa:max-sm:w-full cwa:sm:flex">
          <CwaUiButton
            label="Cancel"
            :disabled="!unsavedCount"
            disabled-reason="Nothing has changed."
            data-testid="form-group-cancel"
            @click="cancel"
          />
          <CwaUiButton
            variant="solid"
            :label="saveLabel"
            :aria-label="saveName"
            :loading="form.saving"
            :disabled="saveDisabled"
            :disabled-reason="saveReason"
            :icon="justSaved && !form.saving ? CheckGlyph : undefined"
            data-testid="form-group-save"
            @click="emit('save')"
          />
        </div>
      </div>
    </div>
    <CwaUiAlert
      v-if="showAlert && hasIssue"
      ref="alert"
      :tone="conflictFields.length ? 'warning' : 'danger'"
      :title="alertTitle"
      class="cwa:mb-section"
      data-testid="form-group-alert"
    >
      <p
        v-if="conflictFields.length"
        class="cwa:m-0"
      >
        Nothing was saved. Choose which version to keep before saving.
      </p>
      <p
        v-else-if="form.formError"
        class="cwa:m-0"
      >
        {{ form.formError }}
      </p>
      <ul
        v-if="alertFields.length"
        class="cwa:mt-1 cwa:mb-0 cwa:list-none cwa:p-0"
      >
        <li
          v-for="field in alertFields"
          :key="field"
        >
          <button
            type="button"
            data-testid="form-group-alert-field"
            class="cwa:cursor-pointer cwa:font-semibold cwa:text-fg cwa:underline cwa:underline-offset-2 cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-accent-fg"
            @click="showField(field)"
          >
            {{ labelOf(field) }}
          </button>
          <span
            v-if="tabLabelOf(field)"
            class="cwa:text-fg-muted"
          > · {{ tabLabelOf(field) }} tab</span>
        </li>
      </ul>
    </CwaUiAlert>
    <template v-if="tabs?.length">
      <div
        v-for="item in tabs"
        v-show="currentTab === item.key"
        :id="`${tabsId}-${item.key}-panel`"
        :key="item.key"
        role="tabpanel"
        :aria-labelledby="`${tabsId}-${item.key}`"
        :data-tab="item.key"
        data-testid="form-group-panel"
      >
        <DialogPanel
          :tab="item.key"
          :unsaved="isUnsaved"
          :register="register"
          :claim="noClaim"
        >
          <slot :name="item.key" />
        </DialogPanel>
      </div>
    </template>
    <slot v-else />
    <span
      role="status"
      aria-live="polite"
      class="cwa:sr-only"
      data-testid="form-group-announcer"
    >{{ announcement }}</span>
  </div>
</template>

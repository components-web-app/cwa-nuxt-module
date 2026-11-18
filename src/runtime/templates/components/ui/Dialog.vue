<script setup lang="ts">
import { computed, nextTick, provide, reactive, ref, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import CwaUiButton from './Button.vue'
import CwaUiAlert from './Alert.vue'
import XMarkIcon from './icon/XMarkIcon.vue'
import Spinner from './Spinner.vue'
import StateGlyph from '../core/ui/StateGlyph.vue'
import CheckGlyph from '../core/ui/CheckGlyph.vue'
import DialogPanel from '../core/ui/DialogPanel.vue'
import { announceKey, dialogSubViewKey, fieldGroupKey, formSurfaceKey, presenceLayerKey } from '../core/ui/field-keys'
import type { DialogSubViewClaim, DialogSubViewGuard } from '../core/ui/field-keys'
import { changesText, dialogTabBadge, dialogTabWords, listText } from '../core/ui/dialog-form'
import type { DialogForm, DialogTab } from '../core/ui/dialog-form'
import { useCwaConfirm } from '#cwa/composables/cwa-confirm'

const SAVED_FOR = 1500

const props = withDefaults(defineProps<{
  title: string
  size?: 'sm' | 'md' | 'lg'
  tabs?: DialogTab[]
  tab?: string
  form?: DialogForm
  noun?: string
  createNoun?: string
  loading?: boolean
  flush?: boolean
  /** @internal */
  kind?: { tone: 'static' | 'dynamic' | 'success' | 'warning', label?: string }
  placement?: 'center' | 'right'
}>(), {
  size: 'md',
  tabs: undefined,
  tab: undefined,
  form: undefined,
  noun: 'page',
  createNoun: undefined,
  loading: false,
  flush: false,
  kind: undefined,
  placement: 'center',
})

const emit = defineEmits<{
  'close': []
  'save': []
  'update:tab': [key: string]
}>()

defineSlots<{
  [key: string]: (() => any) | undefined
}>()

const confirm = useCwaConfirm()
const titleId = useId()
const kindId = useId()
const kindEdges = { static: 'cwa:border-type-static', dynamic: 'cwa:border-type-dynamic', success: 'cwa:border-success', warning: 'cwa:border-warning' }
const tabsId = useId()
const body = useTemplateRef<HTMLElement>('body')
const presenceLayer = useTemplateRef<HTMLElement>('presenceLayer')
provide(presenceLayerKey, { el: presenceLayer, align: 'end' })
const alert = useTemplateRef<InstanceType<typeof CwaUiAlert>>('alert')

const localTab = ref(props.tab ?? props.tabs?.[0]?.key)
const currentTab = computed({
  get: () => props.tab ?? localTab.value,
  set: (key) => {
    localTab.value = key
    key && emit('update:tab', key)
  },
})
const visited = reactive(new Set<string>())
watch(currentTab, key => key && visited.add(key), { immediate: true })

const registry = reactive(new Map<string, { label: string, tab?: string }>())

function register(field: string, label: string, tab?: string) {
  registry.set(field, { label, tab })
  return () => {
    registry.get(field)?.label === label && registry.delete(field)
  }
}

function isUnsaved(field: string) {
  return !!props.form?.unsavedFields.includes(field)
}

provide(announceKey, text => announce(text))
provide(formSurfaceKey, { unsaved: isUnsaved, register: (field, label) => register(field, label) })
if (props.form) {
  provide(fieldGroupKey, {
    model: field => props.form?.model(field),
    undo: () => undefined,
  })
}

const subViews = shallowRef<DialogSubViewClaim[]>([])

function claimSubView(entry: DialogSubViewClaim) {
  subViews.value = [...subViews.value, entry]
  return () => {
    subViews.value = subViews.value.filter(candidate => candidate !== entry)
  }
}

provide(dialogSubViewKey, {
  footer: get => claimSubView({ footer: get }),
  guard: guard => claimSubView({ guard }),
})

const subFooter = computed(() => {
  for (const entry of subViews.value) {
    if (entry.footer && entry.tab === currentTab.value) {
      const footer = entry.footer()
      if (footer) {
        return footer
      }
    }
  }
  return undefined
})

function openGuards() {
  return subViews.value
    .filter(entry => entry.guard && entry.tab === (props.tabs?.length ? currentTab.value : undefined))
    .map(entry => entry.guard as DialogSubViewGuard)
}

function subViewUnsaved() {
  return openGuards().flatMap(guard => guard.unsaved())
}

function leaveSubViews() {
  openGuards().forEach(guard => guard.leave())
}

function askDiscard(names: string[], otherTabsKept: boolean) {
  return confirm({
    title: `Discard ${names.length} unsaved ${names.length === 1 ? 'change' : 'changes'}?`,
    description: `Your changes to ${listText(names)} will be lost.${otherTabsKept ? ' Changes on the other tabs are kept.' : ''}`,
    keep: 'Keep editing',
    go: 'Discard',
  })
}

const keptText = computed(() => {
  const n = unsavedCount.value
  return n ? `${n} unsaved ${props.noun} ${n === 1 ? 'change' : 'changes'} kept` : undefined
})

function fieldsOf(tab: string) {
  return [...registry.entries()].filter(([, entry]) => entry.tab === tab).map(([field]) => field)
}

const badges = computed(() => Object.fromEntries((props.tabs ?? []).map(tab => [tab.key, dialogTabBadge(fieldsOf(tab.key), props.form)])))

function labelOf(field: string) {
  return registry.get(field)?.label ?? field
}

function tabLabelOf(field: string) {
  const tab = registry.get(field)?.tab
  return props.tabs?.find(candidate => candidate.key === tab)?.label
}

const unsavedCount = computed(() => props.form?.unsavedFields.length ?? 0)
const errorFields = computed(() => Object.keys(props.form?.fieldErrors ?? {}))
const conflictFields = computed(() => Object.keys(props.form?.conflicts ?? {}))

const now = ref(Date.now())
let savedTimer: ReturnType<typeof setTimeout> | undefined
watch(() => props.form?.savedAt, (savedAt) => {
  clearTimeout(savedTimer)
  now.value = Date.now()
  if (savedAt && savedAt + SAVED_FOR > now.value) {
    savedTimer = setTimeout(() => {
      now.value = Date.now()
    }, savedAt + SAVED_FOR - now.value)
  }
}, { immediate: true })
const justSaved = computed(() => !!props.form?.savedAt && props.form.savedAt + SAVED_FOR > now.value && !unsavedCount.value)

const blockedText = computed(() => {
  if (conflictFields.value.length) {
    const n = conflictFields.value.length
    return `Choose ${n} ${n === 1 ? 'version' : 'versions'} to save`
  }
  return errorFields.value.length ? `${errorFields.value.length} to fix` : undefined
})

const saveLabel = computed(() => {
  if (props.createNoun) {
    return `+ ${props.createNoun.charAt(0).toUpperCase()}${props.createNoun.slice(1)}`
  }
  if (props.form?.saving) {
    return 'Saving…'
  }
  if (justSaved.value) {
    return 'Saved'
  }
  return unsavedCount.value ? `Save ${changesText(unsavedCount.value)}` : 'Save'
})

const saveName = computed(() => {
  if (props.createNoun) {
    return `Create ${props.createNoun}`
  }
  return unsavedCount.value && !props.form?.saving ? `Save ${unsavedCount.value} unsaved ${unsavedCount.value === 1 ? 'change' : 'changes'}` : undefined
})

const saveDisabled = computed(() => !props.createNoun && (!unsavedCount.value || !!conflictFields.value.length))
const saveReason = computed(() => {
  if (props.createNoun) {
    return undefined
  }
  if (conflictFields.value.length) {
    return blockedText.value
  }
  return unsavedCount.value ? undefined : 'Nothing has changed.'
})

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
    const names = [...new Set(conflictFields.value.map(field => props.form?.conflicts[field]?.name))].filter(Boolean) as string[]
    return `${n} ${n === 1 ? 'field' : 'fields'} changed by ${listText(names)} while you were editing.`
  }
  if (errorFields.value.length) {
    const n = errorFields.value.length
    return `This ${props.noun} wasn't saved. ${n} ${n === 1 ? 'field needs' : 'fields need'} a change.`
  }
  return `This ${props.noun} wasn't saved.`
})

const alertFields = computed(() => conflictFields.value.length ? conflictFields.value : errorFields.value)
const hasIssue = computed(() => !!(conflictFields.value.length || errorFields.value.length || props.form?.formError))

watch(hasIssue, (issue) => {
  if (!issue) {
    showAlert.value = false
  }
})

watch(() => props.form?.failures, async (failures, previous) => {
  if (!failures || failures === previous) {
    return
  }
  showAlert.value = true
  const failed = alertFields.value
  const current = currentTab.value
  if (failed.length && !failed.some(field => registry.get(field)?.tab === current)) {
    const first = props.tabs?.find(tab => failed.some(field => registry.get(field)?.tab === tab.key))
    first && (currentTab.value = first.key)
  }
  announce(alertTitle.value)
  await nextTick()
  body.value?.scrollTo?.({ top: 0 })
  alert.value?.focus()
})

async function showField(field: string) {
  const tab = registry.get(field)?.tab
  tab && (currentTab.value = tab)
  await nextTick()
  const target = body.value?.querySelector<HTMLElement>(`[data-cwa-field="${CSS.escape(field)}"] :is(input, textarea, button, [tabindex]:not([tabindex="-1"]))`)
  target?.focus()
}

let confirming = false

async function confirmDiscard() {
  const names = [...(props.form?.unsavedFields.map(labelOf) ?? []), ...subViewUnsaved()]
  if (!names.length) {
    return true
  }
  if (confirming) {
    return false
  }
  confirming = true
  const discard = await askDiscard(names, false)
  confirming = false
  if (!discard) {
    return false
  }
  props.form?.discard()
  leaveSubViews()
  return true
}

async function requestClose() {
  if (confirming || !await confirmDiscard()) {
    return false
  }
  emit('close')
  return true
}

function onOpenChange(open: boolean) {
  if (!open) {
    requestClose()
  }
}

async function selectTab(key: string) {
  const tab = props.tabs?.find(candidate => candidate.key === key)
  if (!tab || key === currentTab.value || confirming) {
    return
  }
  const names = subViewUnsaved()
  if (names.length) {
    confirming = true
    const discard = await askDiscard(names, true)
    confirming = false
    if (!discard) {
      return
    }
  }
  leaveSubViews()
  currentTab.value = key
}

function onTabKey(event: KeyboardEvent, index: number) {
  const tabs = props.tabs ?? []
  const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }
  if (!(event.key in moves)) {
    return
  }
  event.preventDefault()
  const next = (moves[event.key]! + tabs.length) % tabs.length
  const key = tabs[next]!.key
  selectTab(key).then(() => nextTick(() => document.getElementById(`${tabsId}-${currentTab.value}`)?.focus()))
}

const widths = { sm: 'cwa:sm:w-[28rem]', md: 'cwa:sm:w-[36rem]', lg: 'cwa:sm:w-[48rem]' }
const centred = 'cwa:sm:inset-auto cwa:sm:top-1/2 cwa:sm:left-1/2 cwa:sm:max-h-[calc(100dvh-4rem)] cwa:sm:max-w-[calc(100vw-2rem)] cwa:sm:-translate-x-1/2 cwa:sm:-translate-y-1/2'
const slideOver = 'cwa:sm:inset-y-0 cwa:sm:right-0 cwa:sm:left-auto cwa:sm:w-[min(40rem,100vw)] cwa:sm:motion-safe:animate-[cwa-slide-over-in_var(--cwa-duration-slow)_var(--cwa-ease-out)]'

function glyphOf(key: string) {
  const kind = badges.value[key]?.kind
  return kind === 'conflict' || kind === 'error' ? kind : undefined
}

defineExpose({ requestClose, confirmDiscard, showField, announce })
</script>

<template>
  <DialogRoot
    :open="true"
    @update:open="onOpenChange"
  >
    <DialogPortal>
      <DialogOverlay
        data-testid="dialog-overlay"
        class="cwa:fixed cwa:inset-0 cwa:z-dialog cwa:bg-black/60 cwa:backdrop-blur-sm"
      />
      <DialogContent
        :aria-labelledby="titleId"
        :aria-describedby="kind?.label ? kindId : undefined"
        data-testid="dialog"
        :data-placement="placement"
        class="cwa:fixed cwa:inset-0 cwa:z-dialog cwa:flex cwa:flex-col cwa:bg-surface cwa:text-fg cwa:shadow-popover cwa:outline-none cwa:[--cwa-spacing-control:var(--cwa-spacing-control-lg)] cwa:[--cwa-text-control:var(--cwa-text-control-lg)]"
        :class="placement === 'right' ? slideOver : [centred, widths[size]]"
      >
        <header
          class="cwa:flex cwa:h-[3.75rem] cwa:shrink-0 cwa:items-center cwa:gap-1 cwa:border-b-3 cwa:border-solid cwa:ps-6 cwa:pe-3"
          :class="kind ? kindEdges[kind.tone] : 'cwa:border-line'"
        >
          <DialogTitle
            :id="titleId"
            as="h2"
            class="cwa:m-0 cwa:me-2 cwa:min-w-0 cwa:flex-1 cwa:truncate cwa:text-title cwa:text-fg"
          >
            {{ title }}
          </DialogTitle>
          <span
            v-if="kind?.label"
            :id="kindId"
            data-testid="dialog-kind"
            class="cwa:me-2 cwa:shrink-0 cwa:text-helper cwa:text-fg-muted"
          >{{ kind.label }}</span>
          <slot name="header-actions" />
          <button
            type="button"
            aria-label="Close"
            data-testid="dialog-close"
            class="cwa:grid cwa:size-hit cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:text-fg cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:hover:bg-button cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg"
            @click="requestClose"
          >
            <XMarkIcon class="cwa:size-6" />
          </button>
        </header>
        <slot name="subheader" />
        <div
          v-if="tabs?.length"
          role="tablist"
          :aria-labelledby="titleId"
          class="cwa:flex cwa:h-hit cwa:shrink-0 cwa:items-stretch cwa:overflow-x-auto cwa:border-b cwa:border-line cwa:ps-2 cwa:[scrollbar-width:none]"
        >
          <button
            v-for="(item, index) in tabs"
            :id="`${tabsId}-${item.key}`"
            :key="item.key"
            type="button"
            role="tab"
            :aria-selected="currentTab === item.key ? 'true' : 'false'"
            :aria-controls="`${tabsId}-${item.key}-panel`"
            :aria-disabled="item.disabled ? 'true' : undefined"
            :aria-label="badges[item.key]?.kind ? `${item.label}, ${dialogTabWords(badges[item.key]!)}` : undefined"
            :title="badges[item.key]?.kind ? dialogTabWords(badges[item.key]!) : undefined"
            :tabindex="currentTab === item.key ? 0 : -1"
            :data-badge="badges[item.key]?.kind"
            data-testid="dialog-tab"
            class="cwa:relative cwa:inline-flex cwa:shrink-0 cwa:cursor-pointer cwa:items-center cwa:gap-2 cwa:whitespace-nowrap cwa:px-4 cwa:text-label cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:after:absolute cwa:after:inset-x-0 cwa:after:bottom-0 cwa:after:h-0.5 cwa:after:content-['']"
            :class="[currentTab === item.key ? 'cwa:text-fg cwa:after:bg-accent' : 'cwa:text-fg-muted cwa:hover:text-fg', { 'cwa:opacity-60': item.disabled }]"
            @click="selectTab(item.key)"
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
              data-testid="dialog-tab-unsaved"
              class="cwa:size-2 cwa:rounded-toggle cwa:bg-accent-fg"
            />
          </button>
        </div>
        <div
          ref="body"
          data-testid="dialog-body"
          data-cwa-scroll
          class="cwa:relative cwa:min-h-0 cwa:flex-1 cwa:overflow-y-auto"
          :class="{ 'cwa:p-6': !flush }"
          :aria-busy="loading ? 'true' : undefined"
        >
          <div
            v-if="loading"
            class="cwa:grid cwa:min-h-40 cwa:place-items-center"
          >
            <Spinner size="md" />
          </div>
          <template v-else>
            <CwaUiAlert
              v-if="showAlert && hasIssue"
              ref="alert"
              :tone="conflictFields.length ? 'warning' : 'danger'"
              :title="alertTitle"
              class="cwa:mb-stack"
              data-testid="dialog-alert"
            >
              <p
                v-if="conflictFields.length"
                class="cwa:m-0"
              >
                Nothing was saved. Choose which version to keep before saving.
              </p>
              <p
                v-else-if="form?.formError"
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
                    data-testid="dialog-alert-field"
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
              <template
                v-for="item in tabs"
                :key="item.key"
              >
                <div
                  v-show="currentTab === item.key"
                  :id="`${tabsId}-${item.key}-panel`"
                  role="tabpanel"
                  :aria-labelledby="`${tabsId}-${item.key}`"
                  data-testid="dialog-panel"
                  :data-tab="item.key"
                >
                  <DialogPanel
                    v-if="visited.has(item.key)"
                    :tab="item.key"
                    :unsaved="isUnsaved"
                    :register="register"
                    :claim="claimSubView"
                  >
                    <p
                      v-if="item.disabled"
                      class="cwa:m-0 cwa:text-fg-muted"
                    >
                      {{ item.disabled }}
                    </p>
                    <slot
                      v-else
                      :name="item.key"
                    />
                  </DialogPanel>
                </div>
              </template>
            </template>
            <slot v-else />
          </template>
          <div
            ref="presenceLayer"
            data-testid="presence-layer"
            class="cwa:pointer-events-none cwa:absolute cwa:inset-0 cwa:z-[1]"
          />
        </div>
        <footer
          v-if="subFooter !== 'none' && (subFooter || form || $slots.footer)"
          class="cwa:flex cwa:shrink-0 cwa:items-center cwa:justify-end cwa:gap-actions cwa:bg-surface-raised cwa:px-6 cwa:py-4 cwa:max-sm:px-4 cwa:max-sm:pt-3 cwa:max-sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
          <template v-if="subFooter">
            <p
              v-if="keptText"
              data-testid="dialog-sub-kept"
              class="cwa:m-0 cwa:me-auto cwa:text-helper cwa:text-fg-muted cwa:max-sm:hidden"
            >
              {{ keptText }}
            </p>
            <div class="cwa:grid cwa:grid-cols-2 cwa:gap-actions cwa:max-sm:w-full cwa:sm:flex">
              <CwaUiButton
                label="Cancel"
                data-testid="dialog-sub-cancel"
                @click="subFooter.cancel()"
              />
              <CwaUiButton
                variant="solid"
                :label="subFooter.saveLabel"
                :loading="subFooter.saving"
                :disabled="!!subFooter.disabledReason"
                :disabled-reason="subFooter.disabledReason"
                data-testid="dialog-sub-save"
                @click="subFooter.save()"
              />
            </div>
          </template>
          <template v-else>
            <p
              v-if="blockedText"
              data-testid="dialog-blocked"
              class="cwa:m-0 cwa:text-helper cwa:text-fg-muted cwa:max-sm:hidden"
            >
              {{ blockedText }}
            </p>
            <slot
              v-if="!form"
              name="footer"
            />
            <div
              v-else
              class="cwa:grid cwa:grid-cols-2 cwa:gap-actions cwa:max-sm:w-full cwa:sm:flex"
            >
              <CwaUiButton
                label="Cancel"
                data-testid="dialog-cancel"
                @click="requestClose"
              />
              <CwaUiButton
                variant="solid"
                :label="saveLabel"
                :aria-label="saveName"
                :loading="form.saving"
                :disabled="saveDisabled"
                :disabled-reason="saveReason"
                :icon="justSaved && !form.saving ? CheckGlyph : undefined"
                data-testid="dialog-save"
                @click="emit('save')"
              />
            </div>
          </template>
        </footer>
        <span
          role="status"
          aria-live="polite"
          class="cwa:sr-only"
          data-testid="dialog-announcer"
        >{{ announcement }}</span>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from 'reka-ui'
import Field from '../core/ui/Field.vue'
import type { FieldWidth } from '../core/ui/Field.vue'
import ChevronGlyph from '../core/ui/ChevronGlyph.vue'
import SearchIcon from './icon/SearchIcon.vue'
import ResourceSearchList from '../core/ui/ResourceSearchList.vue'
import SheetSearch from '../core/ui/SheetSearch.vue'
import { opensAsSheet } from '../core/ui/sheet-media'
import { useAnnounce, useFieldModel } from '../core/ui/field-context'
import { fieldBox, fieldDisabled, fieldFill, menuPanel, placeholderLook } from '../core/ui/field-looks'
import { useCwa } from '#cwa/composables/cwa'
import type { CwaResource } from '#cwa/resources/resource-utils'
import type { ResourceModelField } from '#cwa/resources/model-editors'

const DEBOUNCE = 250
const SLOW_SEARCH = 3000
const SLOW_FIRST = 5000

export interface ResourceSearchPage {
  items: CwaResource[]
  total: number
}

const props = withDefaults(defineProps<{
  label: string
  labelHidden?: boolean
  info?: string
  description?: string
  placeholder?: string
  width?: FieldWidth
  disabled?: boolean
  disabledReason?: string
  endpoint: string
  searchParams?: string[]
  order?: Record<string, 'asc' | 'desc'>
  perPage?: number
  noun?: string
  labelOf?: (resource: CwaResource) => string
  descriptionOf?: (resource: CwaResource) => string | undefined
  load?: (term: string, page: number) => Promise<ResourceSearchPage>
  resolve?: (iri: string) => Promise<CwaResource | undefined>
  field?: string
  model?: ResourceModelField<string>
  modelValue?: string | null
}>(), {
  labelHidden: false,
  info: undefined,
  description: undefined,
  placeholder: 'Search',
  width: 'md',
  disabled: false,
  disabledReason: undefined,
  searchParams: () => ['search'],
  order: undefined,
  perPage: 20,
  noun: 'pages',
  labelOf: (resource: CwaResource) => resource.title ?? resource.path ?? resource['@id'],
  descriptionOf: undefined,
  load: undefined,
  resolve: undefined,
  field: undefined,
  model: undefined,
  modelValue: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: string | null | undefined] }>()

const $cwa = useCwa()
const { model, value, state, unbound } = useFieldModel<string>(props, emit)
const announce = useAnnounce()
const id = useId()
const open = ref(false)
const sheetOpen = ref(false)
const sheetId = `${id}-sheet`
const returnTo = ref<HTMLElement | null>()
const anchor = useTemplateRef<{ $el: HTMLElement }>('anchor')
const toggle = useTemplateRef<{ $el: HTMLElement }>('toggle')
const query = ref('')
const results = ref<CwaResource[]>()
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const slow = ref(false)
const failure = ref<'offline' | 'server'>()
const searched = ref('')
const chosenResource = ref<CwaResource>()
const chosenLoading = ref(false)
let requestId = 0
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let slowTimer: ReturnType<typeof setTimeout> | undefined

const chosenLabel = computed(() => chosenResource.value ? props.labelOf(chosenResource.value) : undefined)

watch(value, async (iri) => {
  if (!iri) {
    chosenResource.value = undefined
    return
  }
  if (chosenResource.value?.['@id'] === iri) {
    return
  }
  const known = results.value?.find(resource => resource['@id'] === iri) ?? $cwa.resources.getResource(iri).value?.data
  if (known) {
    chosenResource.value = known
    return
  }
  chosenLoading.value = true
  const fetched = await (props.resolve ? props.resolve(iri) : $cwa.fetchResource({ path: iri, shallowFetch: true }))
  if (value.value === iri) {
    chosenResource.value = fetched
  }
  chosenLoading.value = false
}, { immediate: true })

function stopTimers() {
  clearTimeout(debounceTimer)
  clearTimeout(slowTimer)
}

function cancel() {
  stopTimers()
  requestId++
  loading.value = false
  slow.value = false
}

async function run(term: string, pageNumber: number) {
  stopTimers()
  const id = ++requestId
  loading.value = true
  slow.value = false
  failure.value = undefined
  slowTimer = setTimeout(() => {
    slow.value = true
  }, results.value ? SLOW_SEARCH : SLOW_FIRST)
  try {
    const { items: members, total: found } = await (props.load ?? fetchPage)(term, pageNumber)
    if (id !== requestId) {
      return
    }
    total.value = found
    results.value = pageNumber > 1 ? [...(results.value ?? []), ...members] : members
    page.value = pageNumber
    searched.value = term
    announce(members.length || pageNumber > 1 ? `${results.value.length} of ${total.value} ${props.noun}` : `No ${props.noun} match ${term}`)
  }
  catch {
    if (id !== requestId) {
      return
    }
    failure.value = typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'server'
    announce(failure.value === 'offline' ? 'You’re offline, so this search didn’t run.' : 'The server couldn’t search just now.')
  }
  finally {
    if (id === requestId) {
      loading.value = false
      slow.value = false
      clearTimeout(slowTimer)
    }
  }
}

async function fetchPage(term: string, pageNumber: number): Promise<ResourceSearchPage> {
  const params = new URLSearchParams({ perPage: String(props.perPage), page: String(pageNumber) })
  term && props.searchParams.forEach(param => params.append(param, term))
  Object.entries(props.order ?? {}).forEach(([field, direction]) => params.set(`order[${field}]`, direction))
  const response = await $cwa.fetch({ path: `${props.endpoint}?${params.toString()}` }).response
  const items: CwaResource[] = response._data?.member ?? response._data?.['hydra:member'] ?? []
  return { items, total: response._data?.totalItems ?? response._data?.['hydra:totalItems'] ?? items.length }
}

function onQuery(next: string | undefined) {
  query.value = next ?? ''
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => run(query.value.trim(), 1), DEBOUNCE)
}

watch(() => open.value || sheetOpen.value, (isOpen) => {
  if (isOpen) {
    !results.value && announce(`Loading ${props.noun}`)
    run(query.value.trim(), 1)
    return
  }
  query.value = ''
  cancel()
})

function setOpen(next: boolean) {
  if (next && opensAsSheet()) {
    const focused = document.activeElement
    returnTo.value = focused instanceof HTMLElement && anchor.value?.$el.contains(focused) ? focused : toggle.value?.$el
    sheetOpen.value = true
    return
  }
  open.value = next
}

function onAnchorMousedown(event: MouseEvent) {
  opensAsSheet() && event.preventDefault()
}

onBeforeUnmount(cancel)

function showMore() {
  run(searched.value, page.value + 1)
}

function retry() {
  run(query.value.trim(), 1)
}

function choose(next: unknown) {
  if (typeof next !== 'string') {
    return
  }
  chosenResource.value = results.value?.find(resource => resource['@id'] === next)
  if (next !== value.value) {
    value.value = next
  }
  open.value = false
  sheetOpen.value = false
}

const firstLoad = computed(() => loading.value && !results.value)
const chosenFirst = computed(() => !!value.value && !!chosenResource.value && !results.value?.some(resource => resource['@id'] === value.value))
const more = computed(() => (results.value?.length ?? 0) < total.value)
const inactive = computed(() => props.disabled || unbound)
const reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const list = computed(() => ({
  firstLoad: firstLoad.value,
  loading: loading.value,
  slow: slow.value,
  reducedMotion,
  failure: failure.value,
  noun: props.noun,
  value: value.value,
  chosenFirst: chosenFirst.value,
  chosenLabel: chosenLabel.value,
  results: results.value,
  labelOf: props.labelOf,
  descriptionOf: props.descriptionOf,
  searched: searched.value,
  more: more.value,
  total: total.value,
  perPage: props.perPage,
}))
</script>

<template>
  <Field
    :disabled-reason="disabled ? disabledReason : undefined"
    :label="label"
    :label-hidden="labelHidden"
    :info="info"
    :description="description"
    :width="width"
    :state="state"
    :model="model"
    :control-id="id"
    :inactive="inactive"
    :name="field"
  >
    <template #default="{ describedBy, tone, busy }">
      <ComboboxRoot
        :open="open"
        :model-value="value ?? undefined"
        ignore-filter
        open-on-click
        :reset-search-term-on-blur="false"
        :reset-search-term-on-select="false"
        :disabled="inactive"
        @update:open="setOpen"
        @update:model-value="choose"
      >
        <ComboboxAnchor
          ref="anchor"
          :class="[fieldBox, fieldFill(tone, inactive), 'cwa:gap-2 cwa:pr-3 cwa:pl-3', { [fieldDisabled]: inactive }]"
          @mousedown="onAnchorMousedown"
        >
          <SearchIcon
            class="cwa:size-3.5 cwa:shrink-0 cwa:text-fg-muted"
            aria-hidden="true"
          />
          <span
            v-if="chosenLoading && !open"
            class="cwa:skeleton cwa:h-3 cwa:w-24"
            aria-hidden="true"
            data-testid="search-chosen-skeleton"
          />
          <ComboboxInput
            :id="id"
            :model-value="open ? query : (chosenLabel ?? '')"
            :placeholder="placeholder"
            :aria-describedby="describedBy"
            :aria-invalid="tone === 'danger' ? 'true' : undefined"
            :aria-busy="busy || chosenLoading ? 'true' : undefined"
            data-testid="search-input"
            v-bind="sheetOpen ? { 'aria-expanded': 'true', 'aria-controls': sheetId } : {}"
            class="cwa:h-full cwa:w-0 cwa:min-w-0 cwa:flex-1 cwa:appearance-none cwa:truncate cwa:border-0 cwa:bg-transparent cwa:p-0 cwa:text-control cwa:text-inherit cwa:outline-none cwa:focus:ring-0 cwa:disabled:cursor-not-allowed cwa:pointer-coarse:text-base"
            :class="[placeholderLook(inactive), { 'cwa:sr-only': chosenLoading && !open }]"
            @update:model-value="onQuery"
          />
          <ComboboxTrigger
            ref="toggle"
            :aria-label="`Show ${label} results`"
            data-testid="search-toggle"
            tabindex="-1"
            class="cwa:grid cwa:h-full cwa:cursor-pointer cwa:place-items-center cwa:disabled:cursor-not-allowed"
          >
            <ChevronGlyph />
          </ComboboxTrigger>
        </ComboboxAnchor>
        <ComboboxPortal>
          <ComboboxContent
            position="popper"
            side="bottom"
            align="start"
            :side-offset="4"
            :collision-padding="8"
            :class="[menuPanel, 'cwa:w-(--reka-combobox-trigger-width) cwa:min-w-64']"
            data-testid="search-menu"
          >
            <ComboboxViewport
              class="cwa:max-h-72 cwa:overflow-y-auto cwa:py-1"
              :aria-busy="loading ? 'true' : undefined"
            >
              <ResourceSearchList
                v-bind="list"
                @retry="retry"
                @more="showMore"
              />
            </ComboboxViewport>
          </ComboboxContent>
        </ComboboxPortal>
      </ComboboxRoot>
      <SheetSearch
        v-if="sheetOpen"
        v-model:open="sheetOpen"
        :query="query"
        :model-value="value ?? undefined"
        :label="label"
        :placeholder="placeholder"
        :panel-id="sheetId"
        :return-to="returnTo"
        test-id="search-sheet"
        @update:query="onQuery"
        @update:model-value="choose"
      >
        <ResourceSearchList
          v-bind="list"
          sheet
          @retry="retry"
          @more="showMore"
        />
      </SheetSearch>
    </template>
  </Field>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from 'reka-ui'
import Field from '../core/ui/Field.vue'
import type { FieldWidth } from '../core/ui/Field.vue'
import ChevronGlyph from '../core/ui/ChevronGlyph.vue'
import CheckGlyph from '../core/ui/CheckGlyph.vue'
import CwaUiSpinner from './Spinner.vue'
import SearchIcon from './icon/SearchIcon.vue'
import { useAnnounce, useFieldModel } from '../core/ui/field-context'
import { fieldBox, fieldFill, groupHeading, menuPanel, optionLook } from '../core/ui/field-looks'
import { useCwa } from '#cwa/composables/cwa'
import type { CwaResource } from '#cwa/resources/resource-utils'
import type { ResourceModelField } from '#cwa/resources/model-editors'

const DEBOUNCE = 250
const SLOW_SEARCH = 3000
const SLOW_FIRST = 5000
const SHOW_MORE = '__cwa-show-more__'
const RETRY = '__cwa-retry__'

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

watch(open, (isOpen) => {
  if (isOpen) {
    query.value = ''
    !results.value && announce(`Loading ${props.noun}`)
    run('', 1)
    return
  }
  cancel()
})

onBeforeUnmount(cancel)

function act(event: Event, action: string) {
  event.preventDefault()
  action === SHOW_MORE ? run(searched.value, page.value + 1) : run(query.value.trim(), 1)
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
}

const firstLoad = computed(() => loading.value && !results.value)
const chosenFirst = computed(() => !!value.value && !!chosenResource.value && !results.value?.some(resource => resource['@id'] === value.value))
const more = computed(() => (results.value?.length ?? 0) < total.value)
const inactive = computed(() => props.disabled || unbound)
const reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
</script>

<template>
  <Field
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
        v-model:open="open"
        :model-value="value ?? undefined"
        ignore-filter
        open-on-click
        :reset-search-term-on-blur="false"
        :reset-search-term-on-select="false"
        :disabled="inactive"
        @update:model-value="choose"
      >
        <ComboboxAnchor
          :class="[fieldBox, fieldFill(tone, inactive), 'cwa:gap-2 cwa:pr-3 cwa:pl-3', { 'cwa:opacity-50 cwa:cursor-not-allowed': inactive }]"
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
            class="cwa:h-full cwa:w-0 cwa:min-w-0 cwa:flex-1 cwa:appearance-none cwa:truncate cwa:border-0 cwa:bg-transparent cwa:p-0 cwa:text-control cwa:text-inherit cwa:outline-none cwa:placeholder:text-muted-on-field cwa:focus:ring-0 cwa:disabled:cursor-not-allowed cwa:pointer-coarse:text-base"
            :class="{ 'cwa:sr-only': chosenLoading && !open }"
            @update:model-value="onQuery"
          />
          <ComboboxTrigger
            :aria-label="`Show ${label} results`"
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
              <div
                v-if="firstLoad"
                data-testid="search-loading"
              >
                <p
                  v-if="reducedMotion || slow"
                  class="cwa:m-0 cwa:flex cwa:items-center cwa:gap-2 cwa:px-3 cwa:py-2 cwa:text-fg-muted"
                >
                  <CwaUiSpinner
                    v-if="reducedMotion"
                    size="sm"
                  />
                  {{ slow ? 'Still loading…' : `Loading ${noun}…` }}
                </p>
                <div
                  v-for="row in 5"
                  :key="row"
                  aria-hidden="true"
                  class="cwa:flex cwa:h-option cwa:flex-col cwa:justify-center cwa:gap-1.5 cwa:px-3"
                  data-testid="search-skeleton"
                >
                  <span
                    class="cwa:skeleton cwa:h-2.5"
                    :style="{ width: `${50 + ((row * 37) % 40)}%` }"
                  />
                </div>
              </div>
              <template v-else>
                <p
                  v-if="loading"
                  class="cwa:m-0 cwa:flex cwa:items-center cwa:gap-2 cwa:px-3 cwa:py-2 cwa:text-fg-muted"
                  data-testid="search-searching"
                >
                  <CwaUiSpinner size="sm" />
                  {{ slow ? 'Still searching…' : 'Searching…' }}
                </p>
                <template v-if="failure">
                  <p
                    class="cwa:m-0 cwa:px-3 cwa:py-2 cwa:text-danger-fg"
                    data-testid="search-failure"
                  >
                    {{ failure === 'offline' ? 'You’re offline, so this search didn’t run.' : 'The server couldn’t search just now.' }}
                  </p>
                  <ComboboxItem
                    :value="RETRY"
                    :class="[optionLook, 'cwa:font-semibold cwa:text-accent-fg']"
                    @select="act($event, RETRY)"
                  >
                    Retry
                  </ComboboxItem>
                </template>
                <div :class="{ 'cwa:opacity-55': loading }">
                  <template v-if="chosenFirst">
                    <div :class="groupHeading">
                      Chosen
                    </div>
                    <ComboboxItem
                      :value="value!"
                      :class="optionLook"
                    >
                      <span class="cwa:min-w-0 cwa:flex-1 cwa:truncate">{{ chosenLabel }}</span>
                      <ComboboxItemIndicator><CheckGlyph /></ComboboxItemIndicator>
                    </ComboboxItem>
                  </template>
                  <ComboboxItem
                    v-for="resource in results"
                    :key="resource['@id']"
                    :value="resource['@id']"
                    :text-value="labelOf(resource)"
                    :class="optionLook"
                  >
                    <span class="cwa:flex cwa:min-w-0 cwa:flex-1 cwa:flex-col">
                      <span class="cwa:truncate">{{ labelOf(resource) }}</span>
                      <span
                        v-if="descriptionOf?.(resource)"
                        class="cwa:truncate cwa:text-helper cwa:text-fg-muted"
                      >{{ descriptionOf(resource) }}</span>
                    </span>
                    <ComboboxItemIndicator><CheckGlyph /></ComboboxItemIndicator>
                  </ComboboxItem>
                  <p
                    v-if="results && !results.length && !loading && !failure"
                    class="cwa:m-0 cwa:px-3 cwa:py-2 cwa:text-fg-muted"
                    data-testid="search-empty"
                  >
                    No {{ noun }} match “{{ searched }}”.
                  </p>
                  <template v-if="more && !failure">
                    <p
                      class="cwa:m-0 cwa:px-3 cwa:pt-2 cwa:pb-1 cwa:text-helper cwa:text-fg-muted"
                      data-testid="search-count"
                    >
                      Showing {{ results?.length }} of {{ total }}. Keep typing to narrow it down.
                    </p>
                    <ComboboxItem
                      :value="SHOW_MORE"
                      :class="[optionLook, 'cwa:font-semibold cwa:text-accent-fg']"
                      @select="act($event, SHOW_MORE)"
                    >
                      Show {{ Math.min(perPage, total - (results?.length ?? 0)) }} more
                    </ComboboxItem>
                  </template>
                </div>
              </template>
            </ComboboxViewport>
          </ComboboxContent>
        </ComboboxPortal>
      </ComboboxRoot>
    </template>
  </Field>
</template>

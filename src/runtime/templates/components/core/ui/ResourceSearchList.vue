<script setup lang="ts">
import { ComboboxItem, ComboboxItemIndicator } from 'reka-ui'
import CwaUiSpinner from '../../ui/Spinner.vue'
import CheckGlyph from './CheckGlyph.vue'
import { groupHeading, optionLook, sheetGroupHeading, sheetOptionLook } from './field-looks'
import type { CwaResource } from '#cwa/resources/resource-utils'

const SHOW_MORE = '__cwa-show-more__'
const RETRY = '__cwa-retry__'

const { sheet = false } = defineProps<{
  sheet?: boolean
  firstLoad: boolean
  loading: boolean
  slow: boolean
  reducedMotion: boolean
  failure?: 'offline' | 'server'
  noun: string
  value?: string | null
  chosenFirst: boolean
  chosenLabel?: string
  results?: CwaResource[]
  labelOf: (resource: CwaResource) => string
  descriptionOf?: (resource: CwaResource) => string | undefined
  searched: string
  more: boolean
  total: number
  perPage: number
}>()

const emit = defineEmits<{ retry: [], more: [] }>()

function act(event: Event, action: 'retry' | 'more') {
  event.preventDefault()
  action === 'retry' ? emit('retry') : emit('more')
}

const inset = sheet ? 'cwa:px-4' : 'cwa:px-3'
const look = sheet ? sheetOptionLook : optionLook
const heading = sheet ? sheetGroupHeading : groupHeading
</script>

<template>
  <div
    v-if="firstLoad"
    data-testid="search-loading"
  >
    <p
      v-if="reducedMotion || slow"
      :class="[inset, 'cwa:m-0 cwa:flex cwa:items-center cwa:gap-2 cwa:py-2 cwa:text-fg-muted']"
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
      :class="[inset, sheet ? 'cwa:h-hit' : 'cwa:h-option', 'cwa:flex cwa:flex-col cwa:justify-center cwa:gap-1.5']"
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
      :class="[inset, 'cwa:m-0 cwa:flex cwa:items-center cwa:gap-2 cwa:py-2 cwa:text-fg-muted']"
      data-testid="search-searching"
    >
      <CwaUiSpinner size="sm" />
      {{ slow ? 'Still searching…' : 'Searching…' }}
    </p>
    <template v-if="failure">
      <p
        :class="[inset, 'cwa:m-0 cwa:py-2 cwa:text-danger-fg']"
        data-testid="search-failure"
      >
        {{ failure === 'offline' ? 'You’re offline, so this search didn’t run.' : 'The server couldn’t search just now.' }}
      </p>
      <ComboboxItem
        :value="RETRY"
        :class="[look, 'cwa:font-semibold cwa:text-accent-fg']"
        @select="act($event, 'retry')"
      >
        Retry
      </ComboboxItem>
    </template>
    <div :class="{ 'cwa:opacity-55': loading }">
      <template v-if="chosenFirst">
        <div :class="heading">
          Chosen
        </div>
        <ComboboxItem
          :value="value!"
          :class="look"
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
        :class="look"
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
        :class="[inset, 'cwa:m-0 cwa:py-2 cwa:text-fg-muted']"
        data-testid="search-empty"
      >
        No {{ noun }} match “{{ searched }}”.
      </p>
      <template v-if="more && !failure">
        <p
          :class="[inset, 'cwa:m-0 cwa:pt-2 cwa:pb-1 cwa:text-helper cwa:text-fg-muted']"
          data-testid="search-count"
        >
          Showing {{ results?.length }} of {{ total }}. Keep typing to narrow it down.
        </p>
        <ComboboxItem
          :value="SHOW_MORE"
          :class="[look, 'cwa:font-semibold cwa:text-accent-fg']"
          @select="act($event, 'more')"
        >
          Show {{ Math.min(perPage, total - (results?.length ?? 0)) }} more
        </ComboboxItem>
      </template>
    </div>
  </template>
</template>

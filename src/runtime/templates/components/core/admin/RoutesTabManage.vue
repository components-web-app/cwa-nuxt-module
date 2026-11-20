<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import CwaUiInput from '#cwa/templates/components/ui/Input.vue'
import CwaUiSegmented from '#cwa/templates/components/ui/Segmented.vue'
import CwaReveal from '#cwa/templates/components/core/ui/Reveal.vue'
import CwaUiDatePicker from '#cwa/templates/components/ui/DatePicker.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import CwaUiFormSection from '#cwa/templates/components/ui/FormSection.vue'
import StateGlyph from '#cwa/templates/components/core/ui/StateGlyph.vue'
import RouteRecommendation from '#cwa/templates/components/core/admin/RouteRecommendation.vue'
import type { CwaRouteLiveAt, RouteLiveState } from '#cwa/resources/route-publication'
import { getRouteOwnLiveState, isRouteGatedByAncestor, routeReachableAt } from '#cwa/resources/route-publication'
import { formatDateTime } from '#cwa/resources/date-time-input'
import { normaliseRoutePath, routePathProblem } from '#cwa/resources/route-path'

const { currentPath, lockedPrefix, routePublication, recommendedPath, recommendedFrom, childPaths = [], redirectCount = 0, pathError, noun = 'page', deleting = false, optional = false } = defineProps<{
  currentPath: string
  lockedPrefix?: string
  routePublication?: CwaRouteLiveAt
  recommendedPath?: string
  recommendedFrom?: string
  childPaths?: string[]
  redirectCount?: number
  pathError?: string
  noun?: string
  deleting?: boolean
  optional?: boolean
}>()

const pathModel = defineModel<string>({ required: true })
const liveAtModel = defineModel<string | null | undefined>('liveAt')
const cascadeModel = defineModel<boolean>('cascade', { default: true })
const awaitingDateModel = defineModel<boolean>('awaitingDate', { default: false })

defineEmits<{
  delete: []
}>()

const pathLabelId = useId()
const isNew = computed(() => !currentPath)

function suffixOf(fullPath: string, lock: string | undefined) {
  if (!lock) {
    return fullPath
  }
  if (fullPath === lock) {
    return ''
  }
  return fullPath.startsWith(`${lock}/`) ? fullPath.slice(lock.length + 1) : fullPath.replace(/^\/+/, '')
}

function pathOf(suffix: string, lock: string | undefined) {
  const path = normaliseRoutePath(suffix)
  if (!lock) {
    return !path || path.startsWith('/') ? path : `/${path}`
  }
  const rest = path.replace(/^\/+/, '')
  return rest ? `${lock}/${rest}` : ''
}

const localSuffix = ref(suffixOf(pathModel.value, lockedPrefix))
const typed = ref(false)

function setSuffix(suffix: string) {
  localSuffix.value = suffix
  typed.value = true
  pathModel.value = pathOf(suffix, lockedPrefix)
}

watch(() => lockedPrefix, (lock) => {
  if (typed.value) {
    pathModel.value = pathOf(localSuffix.value, lock)
    return
  }
  localSuffix.value = suffixOf(pathModel.value, lock)
})

const suffixModel = computed({
  get: () => localSuffix.value,
  set: (value: string | null | undefined) => setSuffix(value ?? ''),
})

const hasPath = computed(() => !!localSuffix.value.trim())
const pathInvalid = computed(() => pathError ?? routePathProblem(pathModel.value))

function normaliseSuffix() {
  typed.value && (localSuffix.value = normaliseRoutePath(localSuffix.value))
}
const isRecommended = computed(() => !!recommendedPath && pathModel.value === recommendedPath)

function useRecommended() {
  if (!recommendedPath) {
    return
  }
  setSuffix(suffixOf(recommendedPath, lockedPrefix))
}

const publicationOptions = [
  { label: 'Live', value: 'live' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Not live', value: 'draft' },
]

const localPublicationState = ref<RouteLiveState>(isNew.value && liveAtModel.value === undefined ? 'live' : getRouteOwnLiveState({ liveAt: liveAtModel.value }))
const savedState = getRouteOwnLiveState({ liveAt: routePublication?.liveAt })
const localLiveAt = ref<string | null>(liveAtModel.value ?? null)
const minLiveAt = new Date().toISOString()

const editedPublication = computed<CwaRouteLiveAt>(() => ({ ...routePublication, liveAt: liveAtModel.value }))
const gatedByAncestor = computed(() => !isNew.value && isRouteGatedByAncestor(editedPublication.value))
const reachableAt = computed(() => formatDateTime(routeReachableAt(editedPublication.value)))
const liveSince = computed(() => localPublicationState.value === 'live' && !isNew.value ? formatDateTime(liveAtModel.value) : '')

const publicationModel = computed({
  get: () => localPublicationState.value,
  set: (state: string | null | undefined) => state && handlePublicationStateChange(state as RouteLiveState),
})

const liveAtPickerModel = computed({
  get: () => localLiveAt.value,
  set: (value: string | null | undefined) => {
    localLiveAt.value = value ?? null
    liveAtModel.value = value
  },
})

function handlePublicationStateChange(state: RouteLiveState) {
  localPublicationState.value = state
  if (state === 'live') {
    const storedLiveAt = routePublication?.liveAt
    const nextLiveAt = getRouteOwnLiveState({ liveAt: storedLiveAt }) === 'live' ? storedLiveAt : (new Date()).toISOString()
    if (nextLiveAt !== liveAtModel.value) {
      liveAtModel.value = nextLiveAt
    }
    return
  }
  if (state === 'draft') {
    liveAtModel.value = null
    return
  }
  const scheduled = localLiveAt.value
  const isFuture = !!scheduled && new Date(scheduled).getTime() > Date.now()
  if (!isFuture) {
    localLiveAt.value = null
  }
  liveAtModel.value = isFuture ? scheduled : null
}

watch(() => localPublicationState.value === 'scheduled' && !localLiveAt.value, (awaiting) => {
  awaitingDateModel.value = awaiting
}, { immediate: true })

const pathChanged = computed(() => !isNew.value && pathModel.value !== currentPath)
const childrenUnder = computed(() => childPaths.filter(path => path.startsWith(`${currentPath}/`)).length)

const goLiveLine = computed(() => {
  const state = localPublicationState.value
  if (isNew.value) {
    if (!hasPath.value) {
      return optional ? `Leave the path empty to create the ${noun} without a route.` : 'Enter a path.'
    }
    const when = state === 'scheduled' && localLiveAt.value ? ` from ${formatDateTime(localLiveAt.value)}` : state === 'draft' ? ' once it is set live' : ''
    return `Visitors will reach this ${noun} at ${pathModel.value}${when}.`
  }
  if (state === savedState && (state !== 'scheduled' || liveAtModel.value === routePublication?.liveAt)) {
    return undefined
  }
  if (state === 'live') {
    return 'The route goes live as soon as you save.'
  }
  if (state === 'scheduled') {
    return localLiveAt.value ? `The route goes live on ${formatDateTime(localLiveAt.value)}.` : 'Choose when the route goes live.'
  }
  return `Visitors can no longer reach this ${noun} once you save.`
})

const deleteDescription = computed(() => {
  const lines = [`Visitors to ${currentPath} get “Page not found”.`]
  redirectCount && lines.push(`Its ${redirectCount} old ${redirectCount === 1 ? 'address goes' : 'addresses go'} too.`)
  return lines.join(' ')
})
</script>

<template>
  <div data-testid="route-form">
    <CwaUiFormSection>
      <div>
        <span
          :id="pathLabelId"
          aria-hidden="true"
          class="cwa:mb-1.5 cwa:block cwa:text-label cwa:text-fg"
        >Path</span>
        <div class="cwa:@container">
          <div class="cwa:flex cwa:items-start cwa:@max-[25rem]:flex-col">
            <span
              v-if="lockedPrefix"
              aria-hidden="true"
              data-testid="route-locked-prefix"
              class="cwa:flex cwa:h-control cwa:shrink-0 cwa:items-center cwa:pe-1 cwa:text-fg-muted cwa:pointer-coarse:h-hit"
            >{{ lockedPrefix }}/</span>
            <CwaUiInput
              v-model="suffixModel"
              :label="lockedPrefix ? `Rest of the path after ${lockedPrefix}/` : 'Path'"
              label-hidden
              width="full"
              :invalid="pathInvalid"
              :description="isRecommended ? 'This is the recommended path.' : undefined"
              data-testid="route-suffix"
              class="cwa:min-w-0 cwa:flex-1 cwa:@max-[25rem]:w-full"
              @focusout="normaliseSuffix"
            />
          </div>
        </div>
      </div>
      <RouteRecommendation
        v-if="recommendedPath && !isRecommended && currentPath !== '/'"
        :path="recommendedPath"
        :from="recommendedFrom"
        @use="useRecommended"
      />
      <div class="cwa:flex cwa:flex-col cwa:gap-3">
        <CwaUiSegmented
          v-model="publicationModel"
          label="Go live"
          :options="publicationOptions"
          data-publication-state
        />
        <CwaReveal :when="localPublicationState === 'scheduled'">
          <CwaUiDatePicker
            v-model="liveAtPickerModel"
            label="Goes live"
            :min="minLiveAt"
            data-live-at
          />
        </CwaReveal>
        <p
          v-if="liveSince"
          data-live-since
          class="cwa:m-0 cwa:text-helper cwa:text-fg-muted"
        >
          Live since {{ liveSince }}.
        </p>
      </div>
      <div
        v-if="pathChanged || goLiveLine || gatedByAncestor"
        data-testid="route-consequences"
        class="cwa:flex cwa:flex-col cwa:gap-3 cwa:text-control cwa:text-fg"
      >
        <p
          v-if="pathChanged"
          data-testid="route-old-path"
          class="cwa:m-0 cwa:flex cwa:items-start cwa:gap-2"
        >
          <StateGlyph
            kind="info"
            class="cwa:mt-0.5"
          />
          <span>The old path, <span class="cwa:font-mono">{{ currentPath }}</span>, keeps working: it will redirect here.</span>
        </p>
        <label
          v-if="pathChanged && childrenUnder"
          class="cwa:flex cwa:cursor-pointer cwa:items-start cwa:gap-2"
        >
          <input
            v-model="cascadeModel"
            type="checkbox"
            data-testid="route-cascade"
            class="cwa:mt-0.5 cwa:size-4 cwa:shrink-0 cwa:cursor-pointer cwa:rounded-none cwa:border-0 cwa:bg-field cwa:text-accent cwa:outline-1 cwa:outline-transparent cwa:focus:ring-0 cwa:focus:ring-offset-0 cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
          >
          <span>Also change the {{ childrenUnder }} child {{ childrenUnder === 1 ? 'route that starts' : 'routes that start' }} with <span class="cwa:font-mono">{{ currentPath }}/</span></span>
        </label>
        <p
          v-if="goLiveLine"
          data-testid="route-go-live-line"
          class="cwa:m-0 cwa:flex cwa:items-start cwa:gap-2"
        >
          <StateGlyph
            kind="info"
            class="cwa:mt-0.5"
          />
          <span>{{ goLiveLine }}</span>
        </p>
        <p
          v-if="gatedByAncestor"
          data-effective-live-at
          class="cwa:m-0 cwa:flex cwa:items-start cwa:gap-2"
        >
          <StateGlyph
            kind="conflict"
            class="cwa:mt-0.5"
          />
          <span v-if="reachableAt">A parent route goes live later, on {{ reachableAt }}. Visitors can't reach this {{ noun }} before then.</span>
          <span v-else>A parent route has no go-live date, so visitors can't reach this {{ noun }} until it has one.</span>
        </p>
      </div>
    </CwaUiFormSection>
    <CwaUiFormSection
      v-if="!isNew"
      title="Delete this route"
      :description="deleteDescription"
      data-testid="route-delete-section"
    >
      <div>
        <CwaUiButton
          tone="danger"
          :label="deleting ? 'Deleting…' : 'Delete route'"
          :loading="deleting"
          data-testid="route-delete"
          @click="$emit('delete')"
        />
      </div>
    </CwaUiFormSection>
  </div>
</template>

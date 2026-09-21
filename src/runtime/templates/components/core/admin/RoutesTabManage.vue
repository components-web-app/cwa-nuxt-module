<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import slugify from 'slugify'
import ModalInfo from '#cwa/templates/components/core/admin/form/ModalInfo.vue'
import ModalInput from '#cwa/templates/components/core/admin/form/ModalInput.vue'
import ModalSelect from '#cwa/templates/components/core/admin/form/ModalSelect.vue'
import type { CwaResource } from '#cwa/resources/resource-utils'
import type { CwaRouteLiveAt, RouteLiveState } from '#cwa/resources/route-publication'
import { formatRouteLiveAt, fromRouteLiveAtInput, getRouteOwnLiveState, hasRouteEffectiveLiveAt, isRouteGatedByAncestor, routeLiveAtTimezoneLabel, routeReachableAt, toRouteLiveAtInput } from '#cwa/resources/route-publication'

const { pageResource, parentRoutePrefix, currentPath, disableButtons, hasParentPage, effectiveLiveAt } = defineProps<{
  disableButtons: boolean
  pageResource: CwaResource
  currentPath: string
  parentRoutePrefix?: string | null
  hasParentPage?: boolean
  effectiveLiveAt?: string | null
}>()

const pathModel = defineModel<string>({ required: true })
const liveAtModel = defineModel<string | null | undefined>('liveAt')

defineEmits<{
  save: []
  delete: []
  generate: []
}>()

function splitPath(fullPath: string, prefix: string | null | undefined): { prefix: string, suffix: string } {
  if (prefix && prefix !== '/') {
    if (!fullPath) {
      return { prefix, suffix: '' }
    }
    if (fullPath.startsWith(prefix)) {
      return { prefix, suffix: fullPath.slice(prefix.length) || '' }
    }
  }
  return { prefix: '/', suffix: fullPath }
}

const initial = splitPath(pathModel.value, parentRoutePrefix)
const localPrefix = ref(initial.prefix)
const localSuffix = ref(initial.suffix)

watch([localPrefix, localSuffix], ([prefix, suffix]) => {
  suffix = suffix.trim()
  if (prefix === '/') {
    pathModel.value = suffix.startsWith('/') ? suffix : '/' + suffix
  }
  else {
    const p = prefix.replace(/\/+$/, '')
    const s = suffix.replace(/^\/+/, '')
    pathModel.value = s ? `${p}/${s}` : p
  }
})

watch(() => parentRoutePrefix, (newPrefix) => {
  if (newPrefix && localPrefix.value === '/') {
    const split = splitPath(pathModel.value, newPrefix)
    localPrefix.value = split.prefix
    localSuffix.value = split.suffix
  }
})

const prefixOptions = computed(() => {
  const options = [{ label: '/ (root)', value: '/' }]
  if (parentRoutePrefix && parentRoutePrefix !== '/') {
    options.push({ label: parentRoutePrefix, value: parentRoutePrefix })
  }
  return options
})

const recommendedSuffix = computed(() => {
  if (!pageResource.title) {
    return undefined
  }
  return '/' + slugify(pageResource.title.toLowerCase(), { strict: true })
})

const fullRecommendedPath = computed(() => {
  if (!recommendedSuffix.value) {
    return undefined
  }
  return parentRoutePrefix && parentRoutePrefix !== '/' ? parentRoutePrefix + recommendedSuffix.value : recommendedSuffix.value
})

const isApplyDisabled = computed(() => disableButtons || fullRecommendedPath.value === currentPath)

const pageResourceRouteIri = computed(() => pageResource.route)

const publicationOptions = [
  { label: 'Live', value: 'live' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Not live', value: 'draft' },
]

const localPublicationState = ref<RouteLiveState>(getRouteOwnLiveState({ liveAt: liveAtModel.value }))
const localLiveAt = ref(toRouteLiveAtInput(liveAtModel.value))
const liveAtTimezone = routeLiveAtTimezoneLabel()

const routePublication = computed<CwaRouteLiveAt>(() => {
  const publication: CwaRouteLiveAt = { liveAt: liveAtModel.value }
  if (effectiveLiveAt !== undefined) {
    publication.effectiveLiveAt = effectiveLiveAt
  }
  return publication
})
const gatedByAncestor = computed(() => isRouteGatedByAncestor(routePublication.value))
const reachableAt = computed(() => formatRouteLiveAt(routeReachableAt(routePublication.value)))
const effectiveDateUnknown = computed(() => !hasRouteEffectiveLiveAt(routePublication.value))

function handlePublicationStateChange(state: RouteLiveState) {
  localPublicationState.value = state
  if (state === 'live') {
    liveAtModel.value = (new Date()).toISOString()
    return
  }
  if (state === 'draft') {
    liveAtModel.value = null
    return
  }
  const scheduled = fromRouteLiveAtInput(localLiveAt.value)
  const isFuture = !!scheduled && new Date(scheduled).getTime() > Date.now()
  if (!isFuture) {
    localLiveAt.value = ''
  }
  liveAtModel.value = isFuture ? scheduled : null
}

function handleLiveAtChange(value: string | number | null | undefined) {
  const localValue = value === null || value === undefined ? '' : String(value)
  localLiveAt.value = localValue
  liveAtModel.value = fromRouteLiveAtInput(localValue)
}
</script>

<template>
  <div
    class="cwa:flex cwa:flex-col cwa:gap-y-6"
  >
    <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
      <div class="cwa:flex">
        <div class="cwa:flex-none cwa:w-40">
          <ModalSelect
            v-model="localPrefix"
            label="Prefix"
            :options="prefixOptions"
            container-class="cwa:rounded-r-none cwa:border-r-0"
          />
        </div>
        <div class="cwa:flex-1">
          <ModalInput
            v-model="localSuffix"
            label="Route suffix"
            class="cwa:rounded-l-none"
          />
        </div>
      </div>
      <div>
        <p class="cwa:text-sm cwa:text-stone-300">
          When updating, we will automatically create a new redirect from the old path.
        </p>
      </div>
      <div class="cwa:flex cwa:justify-between">
        <div>
          <CwaUiFormButton
            color="blue"
            :disabled="disableButtons"
            @click="$emit('save')"
          >
            Save Route
          </CwaUiFormButton>
        </div>
        <div v-if="!!pageResourceRouteIri">
          <CwaUiFormButton
            color="grey"
            :disabled="disableButtons"
            @click="$emit('delete')"
          >
            Delete Route
          </CwaUiFormButton>
        </div>
      </div>
    </div>
    <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
      <ModalSelect
        data-publication-state
        :model-value="localPublicationState"
        label="Visibility"
        :options="publicationOptions"
        @update:model-value="handlePublicationStateChange"
      />
      <div
        v-if="localPublicationState === 'scheduled'"
        class="cwa:flex cwa:flex-col cwa:gap-y-2"
      >
        <ModalInput
          data-live-at
          :model-value="localLiveAt"
          label="Goes live"
          type="datetime-local"
          @update:model-value="handleLiveAtChange"
        />
        <p
          data-live-at-timezone
          class="cwa:text-xs cwa:text-stone-300"
        >
          Times are in {{ liveAtTimezone }}.
        </p>
      </div>
      <p
        v-if="gatedByAncestor"
        data-effective-live-at
        class="cwa:text-xs cwa:text-stone-300"
      >
        A parent route holds this page back — it is not reachable until {{ reachableAt }}.
      </p>
      <p
        v-else-if="hasParentPage && effectiveDateUnknown"
        data-parent-live-note
        class="cwa:text-xs cwa:text-stone-300"
      >
        Parent routes must also be live for this page to be reachable.
      </p>
    </div>
    <div
      v-if="recommendedSuffix"
      class="cwa:p-4 cwa:bg-dark/80 cwa:rounded-lg cwa:flex cwa:flex-col cwa:gap-y-2 cwa:text-sm"
    >
      <div>
        <ModalInfo
          label="SEO recommendation"
          class="cwa:font-bold"
        >
          <span data-seo-recommendation>{{ fullRecommendedPath }}</span>
        </ModalInfo>
      </div>
      <div class="cwa:flex cwa:justify-start">
        <CwaUiFormButton
          data-apply-seo
          :color="isApplyDisabled ? 'grey' : 'blue'"
          :disabled="isApplyDisabled"
          class="cwa:text-sm"
          @click="$emit('generate')"
        >
          {{ fullRecommendedPath === currentPath ? 'You are using the recommended route' : 'Apply' }}
        </CwaUiFormButton>
      </div>
      <div class="cwa:text-xs cwa:text-stone-300 cwa:flex cwa:flex-col cwa:gap-y-2">
        <p>Recommended route is based on your page title <b>`{{ pageResource.title }}`</b>.</p>
      </div>
    </div>
  </div>
</template>

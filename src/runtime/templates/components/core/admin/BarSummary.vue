<script setup lang="ts">
import { POPOVER_GAP } from '../ui/popover-gap'
import { computed, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import { PopoverAnchor, PopoverArrow, PopoverClose, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { infoArrow, infoPanel } from '../ui/field-looks'
import XMarkIcon from '../../ui/icon/XMarkIcon.vue'
import Spinner from '../../ui/Spinner.vue'
import StateGlyph from '../ui/StateGlyph.vue'
import FieldStatusTitle from '../ui/FieldStatusTitle.vue'
import FieldStatusError from '../ui/FieldStatusError.vue'
import type { GlyphKind } from '../ui/StateGlyph.vue'
import { useAnnounce } from '../ui/field-context'
import { useCwa } from '#cwa/composables/cwa'
import { findInlineEditor, registerBarStatus } from '#cwa/admin/inline-editors'
import { badgeFor, issueShort, issueText } from '#cwa/admin/field-badge'
import { usePublishState } from '#cwa/admin/publish-state'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { formatDateTime } from '#cwa/resources/date-time-input'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'

const GAP_HOLD = 300
const SAVED_FOR = 1180
const SLOW_AFTER = 1000

const { message } = defineProps<{
  message: string
}>()

const emit = defineEmits<{ show: [field: string] }>()

const $cwa = useCwa()
const announce = useAnnounce()
const iri = $cwa.admin.resourceStackManager.currentIri
const publish = usePublishState($cwa, iri)

const fieldStates = computed(() => {
  const current = iri.value
  if (!current) {
    return [] as [string, CwaFieldState][]
  }
  const iris = current === NEW_RESOURCE_IRI ? [current] : $cwa.resources.findAllPublishableIris(current)
  return iris.flatMap(each => Object.entries($cwa.resources.getResource(each).value?.fieldStates ?? {}))
})

const badge = computed(() => badgeFor(fieldStates.value.map(([, state]) => state)))

const busy = computed(() => $cwa.resourcesManager.requestCount.value > 0 || fieldStates.value.some(([, state]) => state.status === 'saving'))

const phase = ref<'rest' | 'saving' | 'saved'>(busy.value ? 'saving' : 'rest')
let gapTimer: ReturnType<typeof setTimeout> | undefined
let savedTimer: ReturnType<typeof setTimeout> | undefined
let slowTimer: ReturnType<typeof setTimeout> | undefined

function clearTimers() {
  clearTimeout(gapTimer)
  clearTimeout(savedTimer)
  clearTimeout(slowTimer)
}

watch(busy, (isBusy) => {
  if (isBusy) {
    clearTimeout(gapTimer)
    clearTimeout(savedTimer)
    if (phase.value !== 'saving') {
      phase.value = 'saving'
      slowTimer = setTimeout(() => phase.value === 'saving' && announce('Saving…'), SLOW_AFTER)
    }
    return
  }
  clearTimeout(gapTimer)
  gapTimer = setTimeout(() => {
    clearTimeout(slowTimer)
    const failed = badge.value.kind || publish.failed.value
    announce(badge.value.kind ? issueText(badge.value) : failed ? 'Not published' : 'All changes saved')
    if (failed) {
      phase.value = 'rest'
      return
    }
    phase.value = 'saved'
    savedTimer = setTimeout(() => {
      phase.value = 'rest'
    }, SAVED_FOR)
  }, GAP_HOLD)
})

watch(iri, () => {
  clearTimers()
  phase.value = busy.value ? 'saving' : 'rest'
})

const button = useTemplateRef<HTMLButtonElement>('button')
let unregisterStatus: (() => void) | undefined
onMounted(() => {
  unregisterStatus = registerBarStatus($cwa, { open: field => openError(field) })
})

onBeforeUnmount(() => {
  clearTimers()
  unregisterStatus?.()
})

const resourceType = computed(() => iri.value ? getResourceTypeFromIri(iri.value) : undefined)

const hasLive = computed(() => !!(iri.value && $cwa.resources.getResource(iri.value).value?.data?.publishedResource))

const rest = computed<{ glyph: GlyphKind, word: string, about: string }>(() => {
  if (iri.value === NEW_RESOURCE_IRI) {
    return { glyph: 'new', word: 'New', about: 'This component has not been added yet. Add it to place it on the page.' }
  }
  if (publish.published.value === false) {
    const at = publish.scheduledAt.value
    if (at) {
      const date = formatDateTime(at)
      return {
        glyph: 'scheduled',
        word: 'Scheduled',
        about: hasLive.value
          ? `Visitors see the live version until ${date}, when these changes go live. Until then only content administrators see this draft.`
          : `This is unpublished until ${date}, when it goes live. Until then only content administrators can see it.`,
      }
    }
    return {
      glyph: 'draft',
      word: 'Draft',
      about: hasLive.value
        ? 'These changes are unpublished, so visitors still see the live version and only content administrators see this draft. Publish it when you are ready for the changes to go live.'
        : 'This is unpublished, so only content administrators can see it. Publish it when you are ready for it to go live.',
    }
  }
  if (publish.published.value === true) {
    return { glyph: 'live', word: 'Live', about: 'This is published, so visitors can see it. Your changes are saved as a draft, which goes live when you publish it.' }
  }
  if (resourceType.value === CwaResourceTypes.COMPONENT_GROUP) {
    return { glyph: 'group', word: 'Group', about: 'A component group holds the components placed in it. It is not published itself: each of its components is.' }
  }
  return { glyph: 'saved', word: 'Saved', about: 'All changes are saved. This is not published separately, so visitors see changes as soon as they are saved.' }
})

const status = computed<{ state: string, glyph?: GlyphKind, full: string, short: string, about?: string }>(() => {
  if (phase.value === 'saving') {
    return { state: 'saving', full: 'Saving…', short: 'Saving…' }
  }
  if (badge.value.kind) {
    return { state: badge.value.kind, glyph: badge.value.kind, full: `${issueText(badge.value)} →`, short: issueShort(badge.value) }
  }
  if (publish.failed.value) {
    return { state: 'error', glyph: 'error', full: 'Not published · Retry', short: 'Not published' }
  }
  if (phase.value === 'saved') {
    return { state: 'saved', glyph: 'saved', full: 'All changes saved', short: 'Saved' }
  }
  const { glyph, word, about } = rest.value
  return { state: 'rest', glyph, full: word, short: word, about }
})

const aboutId = useId()

const actionable = computed(() => (!!badge.value.kind || publish.failed.value) && phase.value !== 'saving')

function inPageError(field: string | undefined) {
  if (!field) {
    return undefined
  }
  const state = fieldStates.value.find(([name, each]) => name === field && each.status === 'error')?.[1]
  const editor = state && findInlineEditor($cwa, { iri: () => iri.value, field })
  return state && editor?.model ? { field, state, editor, model: editor.model } : undefined
}

function firstToFix() {
  const order: CwaFieldState['status'][] = ['conflict', 'error']
  for (const kind of order) {
    const found = fieldStates.value.find(([, state]) => state.status === kind)
    if (found) {
      return found[0]
    }
  }
  return undefined
}

const opensError = computed(() => !!badge.value.kind && !!inPageError(firstToFix()))

const actionLabel = computed(() => badge.value.kind ? `${issueText(badge.value)}, ${opensError.value ? 'Retry or Reset' : 'show the field'}` : 'Not published, retry')

const open = ref(false)
const errorField = ref<string>()
const shownError = computed(() => inPageError(errorField.value))
const errorBody = useTemplateRef<{ focusRetry: () => void }>('errorBody')

watch(actionable, (isActionable) => {
  isActionable && (open.value = false)
})

watch(shownError, (shown) => {
  shown || (errorField.value = undefined)
})

function openError(field: string) {
  if (!inPageError(field)) {
    return false
  }
  errorField.value = field
  return true
}

function act() {
  if (!actionable.value) {
    open.value = !open.value
    return
  }
  if (badge.value.kind) {
    const field = firstToFix()
    if (field && !openError(field)) {
      emit('show', field)
    }
    return
  }
  publish.retry()
}

function onOpenChange(next: boolean) {
  open.value = next
  if (!next) {
    errorField.value = undefined
  }
}

function keepForOwnButton(event: CustomEvent<{ originalEvent: PointerEvent }>) {
  const target = event.detail.originalEvent.target
  target instanceof Node && button.value?.contains(target) && event.preventDefault()
}

function onOpenAutoFocus(event: Event) {
  event.preventDefault()
  errorBody.value?.focusRetry()
}

function onCloseAutoFocus(event: Event) {
  event.preventDefault()
  button.value?.focus({ preventScroll: true })
}

function closeError(run: () => unknown) {
  errorField.value = undefined
  run()
}

function retry() {
  const shown = shownError.value
  closeError(() => shown?.model.retry?.())
}

function reset() {
  const shown = shownError.value
  closeError(() => shown?.model.reset?.())
}
</script>

<template>
  <PopoverRoot
    :open="!!shownError || (open && !actionable)"
    @update:open="onOpenChange"
  >
    <PopoverAnchor as-child>
      <button
        ref="button"
        type="button"
        :aria-label="actionable ? actionLabel : `Status: ${status.full}`"
        :aria-haspopup="actionable && !opensError ? undefined : 'dialog'"
        :aria-expanded="actionable && !opensError ? undefined : (shownError || open) ? 'true' : 'false'"
        :data-state="status.state"
        data-testid="bar-summary"
        class="cwa:inline-flex cwa:h-full cwa:shrink-0 cwa:cursor-pointer cwa:items-center cwa:gap-2 cwa:whitespace-nowrap cwa:px-2 cwa:text-label cwa:text-fg-muted cwa:outline-1 cwa:outline-transparent cwa:hover:bg-button cwa:aria-expanded:bg-button cwa:aria-expanded:text-fg cwa:aria-expanded:shadow-[inset_0_-2px_0_currentColor] cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:@max-[40rem]:aspect-square cwa:@max-[40rem]:justify-center cwa:@max-[40rem]:px-0"
        :class="actionable ? 'cwa:font-semibold cwa:text-fg' : ''"
        @click="act"
      >
        <Spinner
          v-show="status.state === 'saving'"
          data-testid="bar-summary-spinner"
        />
        <StateGlyph
          v-if="status.glyph"
          :kind="status.glyph"
        />
        <span
          v-if="actionable"
          aria-hidden="true"
          class="cwa:hidden cwa:@min-[64rem]:inline"
        >{{ status.full }}</span>
        <span
          aria-hidden="true"
          class="cwa:hidden cwa:@min-[40rem]:inline"
          :class="actionable ? 'cwa:@min-[64rem]:hidden' : ''"
        >{{ status.short }}</span>
      </button>
    </PopoverAnchor>
    <PopoverPortal>
      <PopoverContent
        v-if="shownError"
        side="top"
        align="end"
        :side-offset="POPOVER_GAP"
        :collision-padding="8"
        :aria-label="`${shownError.editor.label ?? shownError.field}: not saved`"
        data-testid="bar-summary-popover"
        class="cwa:z-context cwa:w-max cwa:max-w-[min(20rem,calc(100vw-1rem))] cwa:bg-surface-menu cwa:p-popover cwa:text-control cwa:text-fg cwa:shadow-popover cwa:outline-none"
        @open-auto-focus="onOpenAutoFocus"
        @close-auto-focus="onCloseAutoFocus"
      >
        <FieldStatusTitle
          :title="`${shownError.editor.label ?? shownError.field}: not saved`"
          glyph="error"
          @close="onOpenChange(false)"
        />
        <FieldStatusError
          ref="errorBody"
          :message="shownError.state.error?.message"
          @retry="retry"
          @reset="reset"
        />
        <PopoverArrow
          :width="12"
          :height="6"
          class="cwa:fill-surface-menu"
        />
      </PopoverContent>
      <PopoverContent
        v-else
        side="top"
        align="end"
        :side-offset="POPOVER_GAP"
        :collision-padding="8"
        :aria-label="status.short"
        :aria-describedby="status.about ? aboutId : undefined"
        data-testid="bar-summary-popover"
        :class="['cwa:z-context cwa:w-max cwa:max-w-[min(20rem,calc(100vw-1rem))] cwa:p-popover cwa:text-control cwa:outline-none', infoPanel]"
        @pointer-down-outside="keepForOwnButton"
        @close-auto-focus="onCloseAutoFocus"
      >
        <div
          class="cwa:flex cwa:h-[1cap] cwa:items-center cwa:gap-2 cwa:font-semibold"
          :class="status.about ? 'cwa:mb-4' : ''"
        >
          <StateGlyph
            v-if="status.glyph"
            :kind="status.glyph"
          />
          <span class="cwa:min-w-0 cwa:flex-1 cwa:trim-text">{{ status.short }}</span>
          <PopoverClose
            aria-label="Close"
            class="cwa:grid cwa:size-6 cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:text-fg cwa:hover:bg-button"
          >
            <XMarkIcon class="cwa:size-3" />
          </PopoverClose>
        </div>
        <p
          v-if="status.about"
          :id="aboutId"
          class="cwa:m-0 cwa:trim-text"
        >
          {{ status.about }}
        </p>
        <PopoverArrow
          :width="14"
          :height="7"
          :class="infoArrow"
        >
          <path
            d="M0 0L6 6L12 0"
            vector-effect="non-scaling-stroke"
          />
        </PopoverArrow>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
  <span
    class="cwa:sr-only"
    aria-live="polite"
    data-testid="bar-live-region"
  >{{ message }}</span>
</template>

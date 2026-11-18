<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, provide, reactive, ref, useTemplateRef, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import type { RouteLocationNormalized } from 'vue-router'
import CwaUiButton from '../../ui/Button.vue'
import CwaUiAlert from '../../ui/Alert.vue'
import CheckGlyph from './CheckGlyph.vue'
import { announceKey, fieldGroupKey, formSurfaceKey, sectionHeadingKey } from './field-keys'
import { changesText, listText } from './dialog-form'
import type { DialogForm } from './dialog-form'
import { useCwaConfirm } from '#cwa/composables/cwa-confirm'

const SAVED_FOR = 1500

const props = defineProps<{
  form: DialogForm
}>()

const emit = defineEmits<{
  save: []
}>()

defineSlots<{
  default: () => any
}>()

const confirm = useCwaConfirm()
const root = useTemplateRef<HTMLElement>('root')
const alert = useTemplateRef<InstanceType<typeof CwaUiAlert>>('alert')

const registry = reactive(new Map<string, string>())

function register(field: string, label: string) {
  registry.set(field, label)
  return () => {
    registry.get(field) === label && registry.delete(field)
  }
}

provide(announceKey, text => announce(text))
provide(formSurfaceKey, { unsaved: field => props.form.unsavedFields.includes(field), register })
provide(fieldGroupKey, { model: field => props.form.model(field), undo: () => undefined })
provide(sectionHeadingKey, 'h2')

function labelOf(field: string) {
  return registry.get(field) ?? field
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
  announce(alertTitle.value)
  await nextTick()
  alert.value?.focus()
})

async function showField(field: string) {
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
        </li>
      </ul>
    </CwaUiAlert>
    <slot />
    <div
      data-testid="form-group-actions"
      class="cwa:sticky cwa:bottom-0 cwa:z-10 cwa:mt-section cwa:flex cwa:items-center cwa:justify-end cwa:gap-actions cwa:border-t cwa:border-line cwa:bg-surface cwa:py-4 cwa:pb-[calc(1rem+env(safe-area-inset-bottom))]"
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
    <span
      role="status"
      aria-live="polite"
      class="cwa:sr-only"
      data-testid="form-group-announcer"
    >{{ announcement }}</span>
  </div>
</template>

<template>
  <DialogBox
    v-model="open"
    title="Clone Here"
    :buttons="buttons"
    :is-loading="adding"
  >
    <Spinner
      v-if="loading"
      :show="true"
    />
    <CwaUiAlertWarning v-else-if="loadError">
      Could not load the available components
    </CwaUiAlertWarning>
    <template v-else-if="result">
      <p
        v-if="scopeNote"
        :class="['cwa:mb-4', scopeNote.className]"
        data-testid="clone-scope"
      >
        {{ scopeNote.text }}
      </p>
      <p
        v-if="!result.options.length"
        data-testid="clone-no-options"
      >
        A component cannot be added here.
      </p>
      <div class="cwa:flex cwa:flex-col cwa:gap-y-3">
        <div
          v-for="option of result.options"
          :key="option.label"
        >
          <button
            type="button"
            :class="buttonClass"
            :disabled="option.disabled || adding"
            data-testid="clone-option"
            @click="choose(option)"
          >
            {{ option.label }}
          </button>
          <ul
            v-if="option.reasons.length"
            class="cwa:mt-1 cwa:text-sm cwa:text-stone-400"
          >
            <li
              v-for="reason of option.reasons"
              :key="reason"
            >
              {{ reason }}
            </li>
          </ul>
        </div>
      </div>
    </template>
  </DialogBox>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import DialogBox from '#cwa/templates/components/core/DialogBox.vue'
import type { ActionButton } from '#cwa/templates/components/core/DialogBox.vue'
import Spinner from '#cwa/templates/components/utils/Spinner.vue'
import { useCwa } from '#cwa/composables/cwa'
import { useCloneMode } from '#cwa/admin/clone-mode'
import { cloneComponent } from '#cwa/admin/clone-component'
import { cloneTargetOptions } from '#cwa/admin/clone-target-options'
import type { CloneScope, CloneTargetOption } from '#cwa/admin/clone-target-options'
import type { ApiDocumentationComponentMetadataCollection } from '#cwa/api/api-documentation'

const props = defineProps<{
  stack: { iri: string }[]
  type: CloneScope
}>()

const emit = defineEmits<{
  close: []
}>()

const scopeMessages: Record<CloneScope, string> = {
  layout: 'This is in the layout: it will appear on every page using it',
  page: 'This is in the page: it will not appear on other pages using the layout',
}

const buttonClass = 'cwa:w-full cwa:rounded-lg cwa:py-3 cwa:px-4 cwa:text-white/70 cwa:bg-stone-800 cwa:enabled:hover:bg-stone-700 cwa:enabled:hover:text-white cwa:transition cwa:border cwa:border-solid cwa:border-stone-700 cwa:cursor-pointer cwa:disabled:cursor-not-allowed cwa:disabled:opacity-50'

const $cwa = useCwa()
const { source } = useCloneMode($cwa)
const resourceStackManager = $cwa.admin.resourceStackManager

const open = ref(true)
const loading = ref(true)
const loadError = ref(false)
const adding = ref(false)
const componentMetadata = shallowRef<ApiDocumentationComponentMetadataCollection>()

const buttons: ActionButton[] = [{ label: 'Cancel', color: 'grey' }]

const result = computed(() => {
  if (!source.value || !componentMetadata.value) {
    return
  }
  return cloneTargetOptions({
    stack: props.stack,
    sourceIri: source.value.iri,
    sourceType: $cwa.resources.getResource(source.value.iri).value?.data?.['@type'],
    componentMetadata: componentMetadata.value,
    resources: $cwa.resources,
    isDataPage: $cwa.resources.isDataPage.value,
    isEditingLayout: resourceStackManager.isEditingLayout.value,
    type: props.type,
  })
})

const scopeNote = computed(() => {
  const scope = result.value?.scope
  if (!scope) {
    return
  }
  if (!scope.switching) {
    return { text: 'Shared layout: this appears on every page', className: 'cwa:text-stone-400' }
  }
  return { text: scopeMessages[scope.type], className: 'cwa:text-yellow' }
})

async function choose(option: CloneTargetOption) {
  const sourceIri = source.value?.iri
  if (option.disabled || adding.value || !sourceIri) {
    return
  }
  adding.value = true
  resourceStackManager.isEditingLayout.value = props.type === 'layout'
  try {
    await cloneComponent($cwa, { sourceIri, target: option.value })
  }
  finally {
    adding.value = false
    open.value = false
  }
}

watch(open, (isOpen) => {
  !isOpen && emit('close')
})

watch(source, (current) => {
  if (!current) {
    open.value = false
  }
})

onMounted(async () => {
  try {
    const metadata = await $cwa.getComponentMetadata(false, false)
    if (!metadata) {
      loadError.value = true
      return
    }
    componentMetadata.value = metadata
  }
  catch {
    loadError.value = true
  }
  finally {
    loading.value = false
  }
})
</script>

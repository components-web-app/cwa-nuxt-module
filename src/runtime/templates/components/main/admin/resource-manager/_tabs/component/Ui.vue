<script lang="ts" setup>
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
import { watchOnce } from '@vueuse/core'
import {
  useCwaResourceManagerTab
} from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'
import type { CwaResourceMeta } from '#cwa/runtime/composables/cwa-resource'
import { useCwaResourceModel } from '#cwa/runtime/composables/cwa-resource-model'
import type { SelectOption } from '#cwa/runtime/templates/components/ui/form/Select.vue'
import { useCwaSelect } from '#cwa/runtime/composables/cwa-select'
import { useDataResolver } from '#cwa/runtime/templates/components/core/useDataResolver'

const { exposeMeta, $cwa, iri } = useCwaResourceManagerTab({
  name: 'UI',
  order: DEFAULT_TAB_ORDER
})

const savedUiComponent = computed(() => iri.value ? $cwa.resources.getResource(iri.value).value?.data?.uiComponent : undefined)

const uiComponentModel = useCwaResourceModel<string>(iri, 'uiComponent', {
  debounceTime: 0
})
const uiClassNamesModel = useCwaResourceModel<string[]>(iri, 'uiClassNames', {
  debounceTime: 0
})

const uiSelect = useCwaSelect(uiComponentModel.model)
const classNamesSelect = useCwaSelect(uiClassNamesModel.model)

const componentMeta = ref<(CwaResourceMeta|null)[]>([])

const current = computed(() => $cwa.admin.resourceStackManager.currentStackItem.value)

const uiOptions = computed(() => {
  const options: SelectOption[] = [{
    label: 'Default',
    value: null
  }]
  componentMeta.value.forEach((meta, index) => {
    // it seems meta can be null when re-mounting the meta resolver when changing to a draft from live (editing)
    options.push({
      label: meta?.cwaResource.name || current.value?.ui?.[index] || 'Unknown',
      value: current.value?.ui?.[index]
    })
  })
  return options
})

const classOptions = computed(() => {
  const options: SelectOption[] = [{
    label: 'Default',
    value: null
  }]
  const currentClasses = current.value?.styles?.value?.classes
  if (currentClasses) {
    for (const [styleName, styles] of Object.entries(currentClasses)) {
      options.push({
        label: styleName,
        value: styles
      })
    }
  }
  return options
})

const disabled = exposeMeta.disabled
disabled.value = !current.value?.styles?.value?.classes.length && !current.value?.ui?.length

const components = computed(() => {
  return current.value?.ui
})

const resolverProps = computed(() => {
  return {
    iri: iri.value
  }
})

const { startDataResolver } = useDataResolver(componentMeta, {
  components,
  props: resolverProps,
  propsValidator: (props: typeof resolverProps.value) => {
    return !!props.iri
  }
})
// seem to need to start here for these to be consistent
startDataResolver()

onMounted(() => {
  // trying to update ui class names too early, as the result may be a different IRI and sending in another
  // request before database is updated can result in sql error
  // when watching uiSelect.model
  watch(uiSelect.model, () => {
    watchOnce(savedUiComponent, () => {
      uiClassNamesModel.model.value = null
      classNamesSelect.model.value = null
    })
  })

  watchEffect(() => {
    uiSelect.options.value = uiOptions.value
    classNamesSelect.options.value = classOptions.value
  })
})

defineExpose(exposeMeta)

</script>

<template>
  <div>
    <div class="cwa-flex cwa-space-x-2">
      <CwaUiFormSelect v-model="uiSelect.model.value" :options="uiSelect.options.value" />
      <CwaUiFormSelect v-model="classNamesSelect.model.value" :options="classNamesSelect.options.value" />
    </div>
  </div>
</template>

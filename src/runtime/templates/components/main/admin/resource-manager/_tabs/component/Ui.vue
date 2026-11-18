<script lang="ts" setup>
import { computed, ref, watchEffect } from 'vue'
import {
  useCwaResourceManagerTab,
} from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import type { CwaResourceMeta } from '#cwa/composables/cwa-resource'
import { useCwaResourceModel } from '#cwa/composables/cwa-resource-model'
import { useDataResolver } from '#cwa/templates/components/core/useDataResolver'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import type { MenuItem } from '#cwa/templates/components/core/ui/menu-entries'
import CwaUiManagerTab from '#cwa/templates/components/ui/ManagerTab.vue'
import CwaUiMultiSelect from '#cwa/templates/components/ui/MultiSelect.vue'
import CwaUiSelect from '#cwa/templates/components/ui/Select.vue'
import { deriveSelectedStyles, mergeSelectedStyles } from '#cwa/composables/cwa-styles'

const { exposeMeta, $cwa, iri } = useCwaResourceManagerTab({
  name: 'UI',
  order: DEFAULT_TAB_ORDER,
})

exposeMeta.fields.push('uiComponent', 'uiClassNames')

const componentMeta = ref<(CwaResourceMeta | null)[]>([])

const current = computed(() => $cwa.admin.resourceStackManager.currentStackItem.value)

const styleClasses = computed<Record<string, string | string[]>>(() => current.value?.styles?.value?.classes || {})
const isMultipleStyles = computed(() => !!current.value?.styles?.value?.multiple)
const showStyleSelect = computed(() => Object.keys(styleClasses.value).length > 0)

const uiModel = useCwaResourceModel<string>(iri, 'uiComponent', {
  debounceTime: 0,
  alsoSend: (_value, at) => $cwa.resources.getResource(at).value?.data?.uiClassNames?.length ? { uiClassNames: null } : undefined,
})

const styleModel = useCwaResourceModel<string[] | string, string[]>(iri, 'uiClassNames', {
  debounceTime: 0,
  get: (stored) => {
    const names = deriveSelectedStyles(stored, styleClasses.value)
    return isMultipleStyles.value ? names : names[0] ?? null
  },
  set: (shown) => {
    const names = Array.isArray(shown) ? shown : shown ? [shown] : []
    const merged = mergeSelectedStyles(names, styleClasses.value)
    return merged.length ? merged : null
  },
})

const styleNamesModel = styleModel as unknown as ResourceModelField<string[]>
const styleNameModel = styleModel as unknown as ResourceModelField<string>

const uiOptions = computed<MenuItem[]>(() => (current.value?.ui ?? []).map((ui, index) => ({
  label: componentMeta.value[index]?.cwaResource.name || ui,
  value: ui,
})))

const styleNameOptions = computed<MenuItem[]>(() =>
  Object.keys(styleClasses.value).map(name => ({ label: name, value: name })),
)

const disabled = exposeMeta.disabled

watchEffect(() => {
  const classesObj = current.value?.styles?.value?.classes
  disabled.value = (!classesObj || !Object.keys(classesObj).length) && !current.value?.ui?.length
})

const components = computed(() => {
  return current.value?.ui
})

const resolverProps = computed(() => {
  return {
    iri: iri.value,
  }
})

const { startDataResolver } = useDataResolver(componentMeta, {
  components,
  props: resolverProps,
  propsValidator: (props: typeof resolverProps.value) => {
    return !!props.iri
  },
})
// seem to need to start here for these to be consistent
startDataResolver()

defineExpose(exposeMeta)
</script>

<template>
  <CwaUiManagerTab>
    <CwaUiSelect
      v-if="uiOptions.length"
      :model="uiModel"
      label="UI"
      nullable
      none-label="Default"
      :options="uiOptions"
      data-testid="ui-select"
    />
    <template v-if="showStyleSelect">
      <CwaUiMultiSelect
        v-if="isMultipleStyles"
        :model="styleNamesModel"
        label="Style"
        placeholder="Default"
        search-placeholder="Search styles"
        :options="styleNameOptions"
        data-testid="style-select"
      />
      <CwaUiSelect
        v-else
        :model="styleNameModel"
        label="Style"
        nullable
        none-label="Default"
        :options="styleNameOptions"
        data-testid="style-select"
      />
    </template>
  </CwaUiManagerTab>
</template>

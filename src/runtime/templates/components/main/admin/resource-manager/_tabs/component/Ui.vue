<script lang="ts" setup>
import { computed, watchEffect } from 'vue'
import {
  useCwaResourceManagerTab,
} from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import { useCwaResourceModel } from '#cwa/composables/cwa-resource-model'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import type { MenuItem } from '#cwa/templates/components/core/ui/menu-entries'
import CwaUiManagerTab from '#cwa/templates/components/ui/ManagerTab.vue'
import CwaUiMultiSelect from '#cwa/templates/components/ui/MultiSelect.vue'
import CwaUiSelect from '#cwa/templates/components/ui/Select.vue'
import { keepDefinedStyleKeys, selectStyleKeys, selectedStyleKeys } from '#cwa/composables/cwa-styles'
import type { CwaStyles, CwaUiVariantConfig } from '#cwa/types'
import { resourcesConfig, uiConfig } from '#build/cwa-config'
import { componentUiAllowance, isUiAllowed } from '#cwa/resources/component-ui-allowance'
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'

const { exposeMeta, $cwa, iri } = useCwaResourceManagerTab({
  name: 'UI',
  order: DEFAULT_TAB_ORDER,
})

exposeMeta.fields.push('uiComponent', 'uiClassNames')

const current = computed(() => $cwa.admin.resourceStackManager.currentStackItem.value)

function storedAt(at: string | undefined) {
  return at ? $cwa.resources.getResource(at).value?.data : undefined
}

function styleConfigOf(type: string | undefined, uiComponent: string | null | undefined): CwaUiVariantConfig | undefined {
  if (uiComponent) {
    return uiConfig[uiComponent]
  }
  return type ? resourcesConfig[type] : undefined
}

const styleConfig = computed(() => {
  const data = storedAt(iri.value)
  return styleConfigOf(data?.['@type'], data?.uiComponent)
})
const styles = computed<CwaStyles>(() => styleConfig.value?.styles ?? {})
const isMultipleStyles = computed(() => !!styleConfig.value?.allowMultiple)
const showStyleSelect = computed(() => Object.keys(styles.value).length > 0)

const uiModel = useCwaResourceModel<string>(iri, 'uiComponent', {
  debounceTime: 0,
  alsoSend: (value, at) => {
    const data = storedAt(at)
    const stored = data?.uiClassNames as string[] | null | undefined
    const kept = keepDefinedStyleKeys(stored, styleConfigOf(data?.['@type'], value)?.styles)
    return (kept?.length ?? 0) !== (stored?.length ?? 0) ? { uiClassNames: kept } : undefined
  },
})

const styleModel = useCwaResourceModel<string[] | string, string[]>(iri, 'uiClassNames', {
  debounceTime: 0,
  get: (stored) => {
    const keys = selectedStyleKeys(stored, styles.value)
    return isMultipleStyles.value ? keys : keys[0] ?? null
  },
  set: (shown) => {
    const keys = Array.isArray(shown) ? shown : shown ? [shown] : []
    return selectStyleKeys(storedAt(iri.value)?.uiClassNames, styles.value, keys)
  },
})

const styleNamesModel = styleModel as unknown as ResourceModelField<string[]>
const styleNameModel = styleModel as unknown as ResourceModelField<string>

const allowance = computed(() => {
  if (!iri.value) {
    return {}
  }
  const prefix = ResourceTypeFromIri.getPathPrefix()
  const owner = $cwa.resources.findPublishedComponentIri(iri.value).value ?? iri.value
  const positions: string[] = storedAt(owner)?.componentPositions ?? []
  const groups = positions.map(position => storedAt(storedAt(position)?.componentGroup))
  const path = prefix && owner.startsWith(prefix) ? owner.slice(prefix.length) : owner
  return componentUiAllowance(groups, path.split('?')[0]!.replace(/\/[^/]*$/, ''), prefix)
})

const storedUi = computed(() => storedAt(iri.value)?.uiComponent as string | null | undefined)
const storedStyles = computed(() => (storedAt(iri.value)?.uiClassNames ?? []) as string[])

const uiOptions = computed<MenuItem[]>(() => (current.value?.ui ?? [])
  .filter(ui => isUiAllowed(allowance.value, ui) || ui === storedUi.value)
  .map(ui => ({
    label: uiConfig[ui]?.name || ui,
    value: ui,
  })))

const primaryAllowed = computed(() => isUiAllowed(allowance.value, null) || !storedUi.value)

const styleNameOptions = computed<MenuItem[]>(() =>
  Object.entries(styles.value)
    .filter(([key]) => !allowance.value.styles || allowance.value.styles.includes(`style:${key}`) || storedStyles.value.includes(`style:${key}`))
    .map(([key, style]) => ({ label: style.label, value: key })),
)

const disabled = exposeMeta.disabled

watchEffect(() => {
  disabled.value = !showStyleSelect.value && !current.value?.ui?.length
})

defineExpose(exposeMeta)
</script>

<template>
  <CwaUiManagerTab>
    <CwaUiSelect
      v-if="uiOptions.length"
      :model="uiModel"
      label="UI"
      :nullable="primaryAllowed"
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

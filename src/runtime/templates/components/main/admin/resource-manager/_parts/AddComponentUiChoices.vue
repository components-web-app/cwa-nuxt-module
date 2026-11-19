<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resourcesConfig, uiConfig } from '#build/cwa-config'
import { selectedStyleKeys } from '#cwa/composables/cwa-styles'
import type { MenuItem } from '#cwa/templates/components/core/ui/menu-entries'
import type { CwaUiVariantConfig } from '#cwa/types'
import CwaUiSelect from '#cwa/templates/components/ui/Select.vue'
import CwaUiMultiSelect from '#cwa/templates/components/ui/MultiSelect.vue'

const props = defineProps<{
  name: string
  ui: string[]
}>()

const uiComponent = defineModel<string | null | undefined>('uiComponent')
const uiClassNames = defineModel<string[] | undefined>('uiClassNames')
const defaultClassNames = [...(uiClassNames.value ?? [])]

const main = computed(() => `CwaComponent${props.name}`)

function readable(component: string) {
  const own = component.replace(new RegExp(`^${main.value}Ui`), '')
  return own.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
}

const uiOptions = computed<MenuItem[]>(() => props.ui.map(component => ({
  label: uiConfig[component]?.name || readable(component),
  value: component,
})))

const styleConfig = computed<CwaUiVariantConfig | undefined>(() => uiComponent.value ? uiConfig[uiComponent.value] : resourcesConfig[props.name])
const styles = computed(() => styleConfig.value?.styles ?? {})
const styleOptions = computed<MenuItem[]>(() => Object.entries(styles.value).map(([key, style]) => ({ label: style.label, value: key })))
const chosenStyles = ref<string[]>([])

watch(() => uiOptions.value.length > 0, (shown) => {
  if (shown && uiComponent.value === undefined) {
    uiComponent.value = null
  }
}, { immediate: true })

watch(styles, (current) => {
  chosenStyles.value = selectedStyleKeys(defaultClassNames, current)
}, { immediate: true })

watch([chosenStyles, styles], () => {
  if (styleOptions.value.length) {
    uiClassNames.value = chosenStyles.value.map(key => `style:${key}`)
  }
}, { immediate: true, deep: true })

const singleStyle = computed({
  get: () => chosenStyles.value[0] ?? null,
  set: (value: string | null | undefined) => {
    chosenStyles.value = value ? [value] : []
  },
})
</script>

<template>
  <CwaUiSelect
    v-if="uiOptions.length"
    v-model="uiComponent"
    label="UI"
    width="full"
    nullable
    none-label="Default"
    :options="uiOptions"
    data-testid="add-component-ui"
  />
  <template v-if="styleOptions.length">
    <CwaUiMultiSelect
      v-if="styleConfig?.multipleStyles"
      v-model="chosenStyles"
      label="Style"
      width="full"
      placeholder="Default"
      search-placeholder="Search styles"
      :options="styleOptions"
      data-testid="add-component-style"
    />
    <CwaUiSelect
      v-else
      v-model="singleStyle"
      label="Style"
      nullable
      width="full"
      none-label="Default"
      :options="styleOptions"
      data-testid="add-component-style"
    />
  </template>
</template>

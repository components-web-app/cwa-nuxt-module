<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resourcesConfig, uiConfig } from '#build/cwa-config'
import { selectedStyleKeys } from '#cwa/composables/cwa-styles'
import type { MenuItem } from '#cwa/templates/components/core/ui/menu-entries'
import type { CwaUiVariantConfig } from '#cwa/types'
import type { ComponentUiAllowance } from '#cwa/resources/component-ui-allowance'
import { isUiAllowed } from '#cwa/resources/component-ui-allowance'
import CwaUiSelect from '#cwa/templates/components/ui/Select.vue'
import CwaUiMultiSelect from '#cwa/templates/components/ui/MultiSelect.vue'

const props = withDefaults(defineProps<{
  name: string
  ui: string[]
  allowance?: ComponentUiAllowance
}>(), { allowance: () => ({}) })

const uiComponent = defineModel<string | null | undefined>('uiComponent')
const uiClassNames = defineModel<string[] | undefined>('uiClassNames')
const defaultClassNames = [...(uiClassNames.value ?? [])]

const main = computed(() => `CwaComponent${props.name}`)

function readable(component: string) {
  const own = component.replace(new RegExp(`^${main.value}Ui`), '')
  return own.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
}

const primaryAllowed = computed(() => isUiAllowed(props.allowance, null))

const uiOptions = computed<MenuItem[]>(() => props.ui.filter(component => isUiAllowed(props.allowance, component)).map(component => ({
  label: uiConfig[component]?.name || readable(component),
  value: component,
})))

const styleConfig = computed<CwaUiVariantConfig | undefined>(() => uiComponent.value ? uiConfig[uiComponent.value] : resourcesConfig[props.name])
const styles = computed(() => styleConfig.value?.styles ?? {})
const allowedStyles = computed(() => Object.entries(styles.value).filter(([key]) => !props.allowance.styles || props.allowance.styles.includes(`style:${key}`)))
const styleOptions = computed<MenuItem[]>(() => allowedStyles.value.map(([key, style]) => ({ label: style.label, value: key })))
const chosenStyles = ref<string[]>([])

watch(() => uiOptions.value.length > 0, (shown) => {
  if (!shown) {
    return
  }
  if (!primaryAllowed.value && !isUiAllowed(props.allowance, uiComponent.value)) {
    uiComponent.value = uiOptions.value[0]!.value as string
    return
  }
  if (uiComponent.value === undefined) {
    uiComponent.value = null
  }
}, { immediate: true })

watch(allowedStyles, (current) => {
  chosenStyles.value = selectedStyleKeys(defaultClassNames, Object.fromEntries(current))
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
    :nullable="primaryAllowed"
    none-label="Default"
    :options="uiOptions"
    data-testid="add-component-ui"
  />
  <template v-if="styleOptions.length">
    <CwaUiMultiSelect
      v-if="styleConfig?.allowMultiple"
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

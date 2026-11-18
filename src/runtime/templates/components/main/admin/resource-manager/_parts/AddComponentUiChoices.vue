<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { CwaResourceMeta } from '#cwa/composables/cwa-resource'
import { useDataResolver } from '#cwa/templates/components/core/useDataResolver'
import { mergeSelectedStyles } from '#cwa/composables/cwa-styles'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import type { MenuItem } from '#cwa/templates/components/core/ui/menu-entries'
import type { ManagerTab } from '#cwa/types'
import CwaUiSelect from '#cwa/templates/components/ui/Select.vue'
import CwaUiMultiSelect from '#cwa/templates/components/ui/MultiSelect.vue'

const props = defineProps<{
  name: string
  ui: string[]
}>()

const uiComponent = defineModel<string | null>('uiComponent', { default: null })
const uiClassNames = defineModel<string[]>('uiClassNames', { default: () => [] })

const globals = getCurrentInstance()?.appContext.components ?? {}
const main = computed(() => `CwaComponent${props.name}`)
const resolvable = computed(() => [main.value, ...props.ui].filter(name => !!globals[name]))
const meta = ref<(CwaResourceMeta | null)[]>([])

useDataResolver(meta, {
  components: resolvable as unknown as Ref<ManagerTab[]>,
  props: ref({ iri: NEW_RESOURCE_IRI }),
})

function metaOf(component: string) {
  const index = resolvable.value.indexOf(component)
  return index < 0 ? undefined : meta.value[index] ?? undefined
}

function readable(component: string) {
  const own = component.replace(new RegExp(`^${main.value}Ui`), '')
  return own.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
}

const uiOptions = computed<MenuItem[]>(() => props.ui.map(component => ({
  label: metaOf(component)?.cwaResource.name || readable(component),
  value: component,
})))

const styles = computed(() => metaOf(uiComponent.value ?? main.value)?.cwaResource.styles)
const styleClasses = computed(() => styles.value?.classes ?? {})
const styleOptions = computed<MenuItem[]>(() => Object.keys(styleClasses.value).map(name => ({ label: name, value: name })))
const chosenStyles = ref<string[]>([])

watch(uiComponent, () => {
  chosenStyles.value = []
})

watch([chosenStyles, styleClasses], () => {
  uiClassNames.value = mergeSelectedStyles(chosenStyles.value, styleClasses.value)
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
      v-if="styles?.multiple"
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
      width="full"
      nullable
      none-label="Default"
      :options="styleOptions"
      data-testid="add-component-style"
    />
  </template>
</template>

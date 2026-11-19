import { computed, provide, ref } from 'vue'
import type { Ref } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { tabFieldsKey } from '#cwa/templates/components/core/ui/field-keys'

export interface CwaResourceManagerTabOptions {
  name: string
  order?: number
  disabled?: boolean | Ref<boolean>
}

export interface CwaResourceManagerTabMeta extends Pick<CwaResourceManagerTabOptions, 'name' | 'order'> {
  disabled: Ref<boolean>
  fields: string[]
}

export const useCwaResourceManagerTab = (options: CwaResourceManagerTabOptions) => {
  const $cwa = useCwa()
  const iri = $cwa.admin.resourceStackManager.currentIri
  const resource = computed(() => iri.value ? $cwa.resources.getResource(iri.value).value : undefined)
  const exposeMeta: CwaResourceManagerTabMeta = {
    name: options.name,
    order: options.order,
    disabled: ref(options.disabled || false),
    fields: [],
  }
  provide(tabFieldsKey, exposeMeta.fields)

  function createComputedState<T = any>(propName: string, initialValue?: T) {
    initialValue !== undefined && $cwa.admin.resourceStackManager.getState(propName) === undefined && $cwa.admin.resourceStackManager.setState(propName, initialValue)
    return computed({
      get(): T {
        return $cwa.admin.resourceStackManager.getState(propName)
      },
      set(val: T) {
        $cwa.admin.resourceStackManager.setState(propName, val)
      },
    })
  }

  return {
    $cwa,
    iri,
    resource,
    exposeMeta,
    createComputedState,
  }
}

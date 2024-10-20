import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { useCwa } from '#cwa/runtime/composables/cwa'

export interface CwaResourceManagerTabOptions {
  name: string
  order?: number
  disabled?: boolean
}

interface CwaResourceManagerTabMeta extends Pick<CwaResourceManagerTabOptions, 'name' | 'order'> {
  disabled: Ref<boolean>
}

export const useCwaResourceManagerTab = (options: CwaResourceManagerTabOptions) => {
  const $cwa = useCwa()
  const iri = $cwa.admin.resourceStackManager.currentIri
  const resource = computed(() => iri.value ? $cwa.resources.getResource(iri.value).value : undefined)
  const exposeMeta: CwaResourceManagerTabMeta = {
    name: options.name,
    order: options.order,
    disabled: ref(options.disabled || false),
  }

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

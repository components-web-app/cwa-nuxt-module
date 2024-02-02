import { computed } from 'vue'
import { useCwa } from '#imports'

export const useCwaResourceManagerStateModel = <T>(property: string) => {
  const $cwa = useCwa()
  return computed<T>({
    get () {
      return !!$cwa.admin.resourceStackManager.getState(property)
    },
    set (newValue) {
      $cwa.admin.resourceStackManager.setState(property, newValue)
    }
  })
}

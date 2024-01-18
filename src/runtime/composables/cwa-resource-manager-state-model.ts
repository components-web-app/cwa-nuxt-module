import { computed } from 'vue'
import { useCwa } from '#imports'

export const useCwaResourceManagerStateModel = <T>(property: string) => {
  const $cwa = useCwa()
  return computed<T>({
    get () {
      return !!$cwa.admin.resourceManager.getState(property)
    },
    set (newValue) {
      $cwa.admin.resourceManager.setState(property, newValue)
    }
  })
}

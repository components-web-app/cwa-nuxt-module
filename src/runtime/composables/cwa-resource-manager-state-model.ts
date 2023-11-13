import { computed } from 'vue'
import { useCwa } from '#imports'

export const useCwaResourceManagerStateModel = <T>(property: string) => {
  const $cwa = useCwa()
  return computed<T>({
    get () {
      return !!$cwa.admin.componentManager.getState(property)
    },
    set (newValue) {
      $cwa.admin.componentManager.setState(property, newValue)
    }
  })
}

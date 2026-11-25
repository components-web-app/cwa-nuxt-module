import { ref } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { useCwaConfirm } from '#cwa/composables/cwa-confirm'
import type { CwaConfirmOptions } from '#cwa/composables/cwa-confirm'
import { useCwaToast } from '#cwa/composables/cwa-toast'
import { useItemPage } from './useItemPage'

export interface CwaAdminItemAction {
  endpoint: string
  method?: 'POST' | 'PATCH'
  body?: unknown
  confirm?: CwaConfirmOptions
  success?: string
}

export const useCwaAdminItem = (ops: Parameters<typeof useItemPage>[0]) => {
  const $cwa = useCwa()
  const confirm = useCwaConfirm()
  const toast = useCwaToast()
  const itemPage = useItemPage(ops)
  const actionRunning = ref(false)

  async function runAction(action: CwaAdminItemAction): Promise<boolean> {
    if (actionRunning.value) {
      return false
    }
    actionRunning.value = true
    try {
      if (action.confirm && !(await confirm(action.confirm))) {
        return false
      }
      await $cwa.resourcesManager.send(action.endpoint, action.method ?? 'POST', action.body)
      if ($cwa.resourcesManager.errors.some(error => error.event?.endpoint === action.endpoint)) {
        return false
      }
      if (action.success) {
        toast.show({ tone: 'success', title: action.success })
      }
      await itemPage.loadResource()
      ops.emit('reload')
      return true
    }
    finally {
      actionRunning.value = false
    }
  }

  return {
    ...itemPage,
    runAction,
    actionRunning,
  }
}

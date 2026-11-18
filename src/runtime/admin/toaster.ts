import { createApp } from 'vue'
import type { App } from 'vue'
import Toaster from '#cwa/templates/components/core/ui/Toaster.vue'

export type CwaToastTone = 'success' | 'info' | 'warning' | 'error'

export interface CwaToastAction {
  label: string
  primary?: boolean
  onClick: () => void
}

export interface CwaToastOptions {
  id?: string
  tone: CwaToastTone
  title: string
  description?: string
  actions?: CwaToastAction[]
  onClose?: () => void
}

export interface CwaToaster {
  show: (options: CwaToastOptions) => void
  dismiss: (id: string) => void
}

export function mountToaster(app: App): CwaToaster {
  const host = document.createElement('div')
  ;(app._container as Element | null ?? document.body).appendChild(host)
  return createApp(Toaster).mount(host) as unknown as CwaToaster
}

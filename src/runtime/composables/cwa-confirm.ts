import { useNuxtApp } from '#app/nuxt'

export interface CwaConfirmLine {
  text: string
  emphasis?: 'strong' | 'muted'
}

export interface CwaConfirmTyped {
  noun: string
  value: string
}

export interface CwaConfirmOptions {
  title: string
  description?: string
  lines?: CwaConfirmLine[]
  keep?: string
  go: string
  tone?: 'danger' | 'accent'
  typed?: CwaConfirmTyped
}

export function typedMatches(typed: string, value: string) {
  return typed.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase()
}

export function typedCanStillMatch(typed: string, value: string) {
  return value.trim().toLocaleLowerCase().startsWith(typed.trimStart().toLocaleLowerCase())
}

export const useCwaConfirm = () => {
  const { vueApp } = useNuxtApp()
  return async (options: CwaConfirmOptions) => {
    const [{ createConfirmDialog }, { default: Confirm }] = await Promise.all([
      import('../admin/confirm-dialog'),
      import('../templates/components/core/ui/Confirm.vue'),
    ])
    const dialog = await createConfirmDialog(vueApp, Confirm)
    const { isCanceled } = await dialog.reveal({ ...options })
    return !isCanceled
  }
}

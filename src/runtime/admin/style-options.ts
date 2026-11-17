import type { SelectOption } from '#cwa/composables/cwa-select-input'
import type { CwaStyles } from '#cwa/types'

export function styleSelectOptions(styles: CwaStyles | undefined): SelectOption[] {
  if (!styles || !Object.keys(styles).length) {
    return []
  }
  return [
    { label: 'Default', value: null },
    ...Object.entries(styles).map(([key, style]) => ({ label: style.label, value: [`style:${key}`] })),
  ]
}

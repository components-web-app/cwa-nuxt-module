export interface MenuItem {
  label: string
  value?: string
  description?: string
  tone?: 'danger'
  disabled?: boolean
  disabledReason?: string
  testId?: string
  onSelect?: () => void
}

export interface MenuGroup {
  group: string | null
  items: MenuItem[]
}

export type MenuEntry = MenuItem | MenuGroup

export function menuGroups(entries: MenuEntry[]): MenuGroup[] {
  const groups: MenuGroup[] = []
  let loose: MenuGroup | undefined
  for (const entry of entries) {
    if ('items' in entry) {
      loose = undefined
      entry.items.length && groups.push(entry)
      continue
    }
    if (!loose) {
      loose = { group: null, items: [] }
      groups.push(loose)
    }
    loose.items.push(entry)
  }
  return groups
}

export function canInsertSelection(
  selectedComponent: string | undefined,
  dynamicType: string | null,
  dynamicProperty: string | null,
): boolean {
  if (!selectedComponent) {
    return false
  }
  if (selectedComponent === 'ComponentPosition') {
    return !!dynamicType && !!dynamicProperty
  }
  return true
}

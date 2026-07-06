/**
 * Whether the add dialog's "Insert" / "Add Now" action should be enabled for the current selection.
 *
 * - A normal component only needs to be selected.
 * - The dynamic "ComponentPosition" additionally requires **both** a page-data type and a field to be
 *   chosen — otherwise the inserted position would have a null `pageDataProperty` (an incomplete
 *   dynamic position).
 */
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

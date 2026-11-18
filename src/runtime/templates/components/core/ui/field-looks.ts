export type FieldTone = 'danger' | 'warning' | undefined

export const fieldBox = 'cwa:flex cwa:h-control cwa:w-full cwa:min-w-0 cwa:items-center cwa:text-control cwa:text-fg cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:ease-out cwa:motion-reduce:transition-none cwa:focus-within:outline-2 cwa:focus-within:outline-offset-2 cwa:focus-within:outline-accent-fg cwa:pointer-coarse:h-hit'

export function fieldFill(tone: FieldTone, inactive: boolean) {
  if (tone === 'danger') {
    return inactive ? 'cwa:bg-field-danger' : 'cwa:bg-field-danger cwa:hover:bg-[color-mix(in_srgb,var(--cwa-color-field-danger)_88%,var(--cwa-color-fg))]'
  }
  if (tone === 'warning') {
    return inactive ? 'cwa:bg-field-warning' : 'cwa:bg-field-warning cwa:hover:bg-[color-mix(in_srgb,var(--cwa-color-field-warning)_88%,var(--cwa-color-fg))]'
  }
  return inactive ? 'cwa:bg-field' : 'cwa:bg-field cwa:hover:bg-field-hover'
}

export type FieldTone = 'danger' | 'warning' | undefined

export const fieldBox = 'cwa:flex cwa:h-control cwa:w-full cwa:min-w-0 cwa:items-center cwa:text-control cwa:text-fg cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:ease-out cwa:motion-reduce:transition-none cwa:outline-1 cwa:outline-transparent cwa:focus-within:outline-2 cwa:focus-within:outline-offset-2 cwa:focus-within:outline-accent-fg cwa:pointer-coarse:h-hit'

export const fieldDisabled = 'cwa:cursor-not-allowed cwa:text-fg-disabled'

export const placeholderLook = (inactive: boolean) => inactive ? 'cwa:placeholder:text-fg-disabled' : 'cwa:placeholder:text-muted-on-field'

export function fieldFill(tone: FieldTone, inactive: boolean) {
  if (tone === 'danger') {
    return inactive ? 'cwa:bg-field-danger' : 'cwa:bg-field-danger cwa:hover:bg-[color-mix(in_srgb,var(--cwa-color-field-danger)_88%,var(--cwa-color-fg))]'
  }
  if (tone === 'warning') {
    return inactive ? 'cwa:bg-field-warning' : 'cwa:bg-field-warning cwa:hover:bg-[color-mix(in_srgb,var(--cwa-color-field-warning)_88%,var(--cwa-color-fg))]'
  }
  return inactive ? 'cwa:bg-field' : 'cwa:bg-field cwa:hover:bg-field-hover'
}

export const menuPanel = 'cwa:z-context cwa:max-h-72 cwa:max-w-[min(22rem,calc(100vw-1rem))] cwa:overflow-hidden cwa:bg-surface-menu cwa:text-control cwa:text-fg cwa:shadow-popover cwa:outline-none cwa:motion-safe:data-[state=open]:animate-[cwa-line-in_150ms_ease-out]'

export const infoPanel = 'cwa:bg-surface-menu cwa:text-fg cwa:leading-normal cwa:shadow-popover cwa:ring-1 cwa:ring-line'

export const infoArrow = 'cwa:fill-surface-menu cwa:stroke-line'

export const optionLook = 'cwa:relative cwa:flex cwa:min-h-option cwa:cursor-pointer cwa:items-center cwa:gap-2 cwa:px-3 cwa:py-1.5 cwa:text-fg cwa:outline-none cwa:select-none cwa:data-highlighted:bg-menu-highlight cwa:data-highlighted:shadow-[inset_2px_0_0_var(--cwa-color-accent-fg)] cwa:data-disabled:cursor-not-allowed cwa:data-[state=checked]:font-medium'

export const groupHeading = 'cwa:px-3 cwa:pt-2 cwa:pb-1 cwa:text-helper cwa:text-fg-muted'

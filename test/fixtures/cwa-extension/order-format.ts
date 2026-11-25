export function money(minor: number | undefined, currency = 'GBP') {
  return typeof minor === 'number' ? new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(minor / 100) : undefined
}

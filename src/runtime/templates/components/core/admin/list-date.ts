const listDateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function listDate(value: string | null | undefined) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : listDateFormat.format(date)
}

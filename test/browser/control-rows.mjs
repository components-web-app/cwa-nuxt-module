export const controlRows = (rootSelector) => {
  const root = rootSelector ? document.querySelector(rootSelector) : document.body
  const skip = '[data-testid="toaster"], [data-reka-popper-content-wrapper], [role="menu"], [role="listbox"], [role="grid"], .cwa\\:sr-only, [data-testid="field-info"], [data-kit-exempt]'
  const visible = (element) => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden'
  }
  const boxOf = (input) => {
    const height = input.getBoundingClientRect().height
    let element = input
    for (let step = 0; step < 5 && element.parentElement; step++) {
      element = element.parentElement
      if (/(^| )cwa:(h-control|h-hit|h-full|min-h-hit)( |$)/.test(element.className) && element.getBoundingClientRect().height >= height) {
        return element
      }
    }
    return input
  }
  const items = new Set()
  for (const input of root.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), [role="spinbutton"]')) {
    items.add(boxOf(input))
  }
  for (const group of root.querySelectorAll('[data-testid="segmented"]')) {
    items.add(group)
  }
  const switches = [...root.querySelectorAll('[role="switch"]')].map(track => ({ track, row: track.parentElement }))
  for (const { row } of switches) {
    items.add(row)
  }
  for (const button of root.querySelectorAll('button, [role="combobox"]')) {
    const dialogTab = button.closest('[role="tablist"]') && !button.closest('[data-testid="manager-bar"]')
    const smallIcon = /(^| )cwa:(h-8|size-8)( |$)/.test(button.className) && button.getAttribute('aria-label') && !button.textContent.trim()
    if (!dialogTab && !smallIcon) {
      items.add(button)
    }
  }
  const list = [...items].filter(element => visible(element) && !element.closest(skip))
  const outer = list.filter(element => !list.some(other => other !== element && other.contains(element)))
  const measured = outer.map((element) => {
    const rect = element.getBoundingClientRect()
    const name = (element.getAttribute('aria-label') || element.textContent || element.dataset.testid || element.tagName).trim().replace(/\s+/g, ' ').slice(0, 28)
    return { element, centre: rect.top + rect.height / 2, height: Math.round(rect.height * 10) / 10, name }
  })
  const depth = (a, b) => {
    let steps = 0
    let element = a.element
    while (element && !element.contains(b.element)) {
      element = element.parentElement
      steps++
    }
    return steps
  }
  const rows = []
  for (const item of measured) {
    const row = rows.find(row => row.some(other => Math.abs(other.centre - item.centre) < 6 && depth(other, item) <= 5))
    if (row) {
      row.push(item)
    }
    else {
      rows.push([item])
    }
  }
  const where = element => element.closest('section[aria-labelledby]')?.getAttribute('aria-labelledby') || element.closest('[data-testid]')?.dataset.testid || ''
  const spread = row => Math.max(...row.map(item => item.height)) - Math.min(...row.map(item => item.height))
  const mismatched = rows
    .filter(row => row.length > 1 && spread(row) > 1)
    .map(row => `${where(row[0].element)}: ${row.map(item => `${item.name}=${item.height}`).join(' | ')}`)
  const offCentre = switches
    .filter(({ track }) => visible(track) && !track.closest(skip))
    .map(({ track, row }) => {
      const a = track.getBoundingClientRect()
      const b = row.getBoundingClientRect()
      return { off: Math.abs((a.top + a.height / 2) - (b.top + b.height / 2)), name: where(track) }
    })
    .filter(({ off }) => off > 1)
    .map(({ off, name }) => `switch off centre by ${off} in ${name}`)
  return { rows: rows.filter(row => row.length > 1).length, problems: [...mismatched, ...offCentre] }
}

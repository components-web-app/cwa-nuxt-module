export function measureTopBar(list: HTMLElement) {
  const gap = Number.parseFloat(getComputedStyle(list).columnGap) || 0
  const home = list.querySelector<HTMLElement>('[data-top-bar-home]')
  const more = list.querySelector<HTMLElement>('[data-top-bar-more]')
  const homeWidth = (home?.offsetWidth ?? 0) + gap
  const widths: Record<string, number> = {}
  for (const item of list.querySelectorAll<HTMLElement>('[data-top-bar-id]')) {
    if (!item.hidden) {
      widths[item.dataset.topBarId!] = item.offsetWidth + gap
    }
  }
  return {
    available: list.clientWidth + gap - homeWidth,
    widths,
    more: more?.offsetWidth ? more.offsetWidth + gap : homeWidth,
  }
}

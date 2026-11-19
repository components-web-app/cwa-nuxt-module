export function pageDataNoun(className?: string) {
  const name = (className ?? '').split('\\').pop()!.replace(/(?<=.)Data$/, '')
  return name ? name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase() : 'page data'
}

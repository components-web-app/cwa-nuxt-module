export interface ComponentUiAllowance {
  ui?: (string | null)[]
  styles?: string[]
}

interface GroupWithUiRules {
  allowedComponentUi?: Record<string, ComponentUiAllowance> | null
}

function intersect<T>(lists: T[][]): T[] | undefined {
  if (!lists.length) {
    return undefined
  }
  return lists.reduce((kept, list) => kept.filter(value => list.includes(value)))
}

export function componentUiAllowance(groups: (GroupWithUiRules | undefined)[], endpoint: string, prefix?: string): ComponentUiAllowance {
  const strip = (iri: string) => prefix && iri.startsWith(prefix) ? iri.slice(prefix.length) : iri
  const rules = groups.flatMap(group => Object.entries(group?.allowedComponentUi ?? {})
    .filter(([collection]) => strip(collection) === endpoint)
    .map(([, rule]) => rule))
  const allowance: ComponentUiAllowance = {}
  const ui = intersect(rules.flatMap(rule => rule.ui ? [rule.ui] : []))
  const styles = intersect(rules.flatMap(rule => rule.styles ? [rule.styles] : []))
  ui && (allowance.ui = ui)
  styles && (allowance.styles = styles)
  return allowance
}

export function isUiAllowed(allowance: ComponentUiAllowance, uiComponent: string | null | undefined) {
  return !allowance.ui || allowance.ui.includes(uiComponent ?? null)
}

export function refusedStyles(allowance: ComponentUiAllowance, uiClassNames: string[] | null | undefined) {
  return allowance.styles ? (uiClassNames ?? []).filter(style => !allowance.styles!.includes(style)) : []
}

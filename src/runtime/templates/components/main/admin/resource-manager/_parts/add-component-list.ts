export const DYNAMIC_COMPONENT = 'ComponentPosition'

export interface AddComponentChoice {
  name: string
  label: string
  description?: string
  group?: string
  count: number
  allowed: boolean
}

export interface AddComponentSection {
  key: string
  label: string
  options: AddComponentChoice[]
}

export interface AddComponentList {
  quick: AddComponentChoice[]
  sections: AddComponentSection[]
  blocked?: AddComponentChoice
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', ['#39']: '\'' }

export function hasMarkup(text: string): boolean {
  return /<[a-z/!][^>]*>/i.test(text)
}

export function plainText(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (_, entity: string) => ENTITIES[entity]!)
    .replace(/\s+/g, ' ')
    .trim()
}

export function normaliseQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ')
}

export function matchRank(choice: AddComponentChoice, query: string): number {
  const q = normaliseQuery(query).toLowerCase()
  if (!q) {
    return 0
  }
  const name = choice.label.toLowerCase()
  if (name.startsWith(q)) {
    return 1
  }
  if (name.split(/\s+/).some(word => word.startsWith(q))) {
    return 2
  }
  if (name.includes(q)) {
    return 3
  }
  if (choice.group?.toLowerCase().includes(q)) {
    return 4
  }
  if (choice.description?.toLowerCase().includes(q)) {
    return 5
  }
  return 0
}

function byLabel(a: AddComponentChoice, b: AddComponentChoice) {
  return a.label.localeCompare(b.label)
}

export function buildAddComponentList(choices: AddComponentChoice[], query: string, dynamic?: AddComponentChoice): AddComponentList {
  const q = normaliseQuery(query)
  const allowed = choices.filter(choice => choice.allowed)
  const quick = q ? [] : allowed.filter(choice => choice.count > 0).sort((a, b) => b.count - a.count || byLabel(a, b))
  const listed = allowed.filter(choice => (q ? matchRank(choice, q) > 0 : choice.count === 0))
  const rank = (a: AddComponentChoice, b: AddComponentChoice) => matchRank(a, q) - matchRank(b, q) || byLabel(a, b)

  const grouped = allowed.some(choice => choice.group)
  const groups = [...new Set(listed.map(choice => choice.group).filter((group): group is string => !!group))].sort((a, b) => a.localeCompare(b))
  const sections: AddComponentSection[] = grouped
    ? [...groups, undefined].map(group => ({
        key: group ?? 'other',
        label: group ?? 'Other',
        options: listed.filter(choice => choice.group === group).sort(rank),
      }))
    : [{ key: 'components', label: 'Components', options: [...listed].sort(rank) }]

  if (dynamic && (!q || matchRank(dynamic, q) > 0)) {
    sections.push({ key: 'dynamic', label: 'Dynamic', options: [dynamic] })
  }

  const filled = sections.filter(section => section.options.length)
  if (q) {
    const best = (section: AddComponentSection) => Math.min(...section.options.map(choice => matchRank(choice, q)))
    filled.sort((a, b) => best(a) - best(b))
  }

  const blocked = q && !filled.length
    ? choices.filter(choice => !choice.allowed && matchRank(choice, q) > 0).sort(rank)[0]
    : undefined

  return { quick, sections: filled, blocked }
}

export function countComponentsInGroup(componentIris: (string | undefined | null)[], endpoints: Record<string, string>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const iri of componentIris) {
    if (!iri) {
      continue
    }
    const name = Object.keys(endpoints).find(candidate => iri.startsWith(`${endpoints[candidate]}/`))
    if (name) {
      counts[name] = (counts[name] ?? 0) + 1
    }
  }
  return counts
}

export interface AddTargetInput {
  targetIsGroup: boolean
  addAfter: boolean | null
  groupHasPositions: boolean
  anchor?: string
}

export function addTargetPlace({ targetIsGroup, addAfter, groupHasPositions, anchor }: AddTargetInput): string | undefined {
  if (addAfter === null) {
    return undefined
  }
  if (targetIsGroup) {
    if (!groupHasPositions) {
      return undefined
    }
    return addAfter ? 'at the end' : 'at the start'
  }
  return `${addAfter ? 'after' : 'before'} ${anchor ?? 'the selected component'}`
}

export function pageDataNoun(pageDataType: string | undefined): string {
  if (!pageDataType) {
    return 'page'
  }
  const words = pageDataType.replace(/Data$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().trim()
  return words || 'page'
}

export function groupDisplayName(reference: string | undefined): string {
  return reference?.replace(/_\/.*$/, '') || 'this group'
}

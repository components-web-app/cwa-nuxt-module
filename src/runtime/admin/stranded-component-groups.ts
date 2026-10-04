import { computed } from 'vue'
import type Cwa from '#cwa/cwa'
import { useCwa } from '#cwa/composables/cwa'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import { componentGroupDeclarations } from '#build/cwa-component-group-declarations'

export type ComponentGroupDeclaration
  = | { reference: string | null, location: 'self' | 'layout' | 'unknown' }
    | { reference: string | null, location: 'fixed', locationReference: string }

export type ComponentGroupDeclarations = Record<string, ComponentGroupDeclaration[]>

export interface StrandedGroupPosition {
  iri: string
  component?: string
  componentType?: string
  pageDataProperty?: string
}

export interface StrandedComponentGroup {
  iri: string
  reference: string
  positions: StrandedGroupPosition[]
}

export interface ShownComponentGroup {
  iri: string
  reference: string
}

interface Owner {
  iris: string[]
  location: string
  templates: (string | undefined)[]
}

function shortReference(group: CwaResource): string {
  const reference: string = group.reference ?? group['@id']
  const suffix = group.location ? `_${group.location}` : undefined
  return suffix && reference.endsWith(suffix) ? reference.slice(0, -suffix.length) : reference
}

function iriList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((iri): iri is string => typeof iri === 'string') : []
}

function orderedPositionIris($cwa: Cwa, groupIri: string): string[] {
  return ($cwa.resources.getOrderedPositionsForGroup(groupIri, false) ?? []).filter(iri => !iri.endsWith(NEW_RESOURCE_IRI))
}

function templateName(prefix: string, data: CwaResource | undefined): string | undefined {
  const name: string | undefined = data?.uiComponent || data?.['@type']
  return name ? prefix + name.replace(new RegExp(`^${prefix}`), '') : undefined
}

function siteWideMatcher(declarations: ComponentGroupDeclarations, layoutIri: string | undefined) {
  const exact = new Set<string>()
  const prefixes: string[] = []
  const suffixes: string[] = []
  let anything = false
  for (const declaration of Object.values(declarations).flat()) {
    if (declaration.location === 'self') {
      continue
    }
    if (declaration.location === 'unknown') {
      if (declaration.reference === null) {
        anything = true
      }
      else {
        prefixes.push(`${declaration.reference}_`)
      }
      continue
    }
    const target = declaration.location === 'fixed' ? declaration.locationReference : layoutIri
    if (target === undefined) {
      continue
    }
    if (declaration.reference === null) {
      suffixes.push(`_${target}`)
    }
    else {
      exact.add(`${declaration.reference}_${target}`)
    }
  }
  return {
    anything,
    matches: (reference: string) => exact.has(reference)
      || prefixes.some(prefix => reference.startsWith(prefix))
      || suffixes.some(suffix => reference.endsWith(suffix)),
  }
}

function matchesOwner(reference: string, owner: Owner, declarations: ComponentGroupDeclaration[]) {
  return declarations.some((declaration) => {
    if (declaration.location !== 'self') {
      return false
    }
    if (declaration.reference === null) {
      return reference.endsWith(`_${owner.location}`)
    }
    return reference === `${declaration.reference}_${owner.location}`
  })
}

function findStrandedComponentGroups($cwa: Cwa, declarations: ComponentGroupDeclarations) {
  const stranded: StrandedComponentGroup[] = []
  const shown: ShownComponentGroup[] = []
  const getData = (iri: string): CwaResource | undefined => $cwa.resources.getResource(iri).value?.data

  const layoutIri = $cwa.resources.layoutIri.value
  const siteWide = siteWideMatcher(declarations, layoutIri)
  if (siteWide.anything) {
    return { stranded, shown }
  }

  const owners: Owner[] = []
  if (layoutIri && getData(layoutIri)) {
    owners.push({ iris: [layoutIri], location: layoutIri, templates: [getData(layoutIri)?.uiComponent] })
  }
  const depthCount = $cwa.resources.depthCount.value
  for (let depth = 0; depth < depthCount; depth++) {
    const pageIri = $cwa.resources.pageIriAtDepth(depth).value
    if (pageIri && getData(pageIri)) {
      owners.push({ iris: [pageIri], location: pageIri, templates: [templateName('CwaPage', getData(pageIri))] })
    }
  }

  const visitedComponents = new Set<string>()
  const addComponentOwner = (componentIri: string) => {
    const iris = $cwa.resources.findAllPublishableIris(componentIri).filter(iri => !!getData(iri))
    if (!iris.length || iris.some(iri => visitedComponents.has(iri))) {
      return
    }
    iris.forEach(iri => visitedComponents.add(iri))
    owners.push({
      iris,
      location: $cwa.resources.findPublishedComponentIri(componentIri).value ?? componentIri,
      templates: iris.map(iri => templateName('CwaComponent', getData(iri))),
    })
  }

  const strandedGroups = new Map<string, CwaResource>()
  const shownGroups = new Set<string>()
  for (let index = 0; index < owners.length; index++) {
    const owner = owners[index]!
    const ownerDeclarations = owner.templates.map(template => template === undefined ? undefined : declarations[template])
    if (ownerDeclarations.some(declaration => declaration === undefined)) {
      continue
    }
    const selfDeclarations = ownerDeclarations.flat() as ComponentGroupDeclaration[]
    for (const groupIri of owner.iris.flatMap(iri => iriList(getData(iri)?.componentGroups))) {
      const group = getData(groupIri)
      if (!group || shownGroups.has(groupIri)) {
        continue
      }
      const reference: string = group.reference ?? ''
      if (!siteWide.matches(reference) && !matchesOwner(reference, owner, selfDeclarations)) {
        strandedGroups.has(groupIri) || strandedGroups.set(groupIri, group)
        continue
      }
      strandedGroups.delete(groupIri)
      shownGroups.add(groupIri)
      shown.push({ iri: groupIri, reference: shortReference(group) })
      for (const positionIri of orderedPositionIris($cwa, groupIri)) {
        const component = getData(positionIri)?.component
        if (typeof component === 'string' && !component.endsWith(NEW_RESOURCE_IRI)) {
          addComponentOwner(component)
        }
      }
    }
  }

  for (const [groupIri, group] of strandedGroups) {
    stranded.push({
      iri: groupIri,
      reference: shortReference(group),
      positions: orderedPositionIris($cwa, groupIri).map((positionIri) => {
        const position = getData(positionIri)
        const component: string | undefined = position?.component
        return {
          iri: positionIri,
          component,
          componentType: component ? getData(component)?.['@type'] : undefined,
          pageDataProperty: position?.pageDataProperty ?? undefined,
        }
      }),
    })
  }
  return { stranded, shown }
}

export function useStrandedComponentGroups() {
  const $cwa = useCwa()

  const report = computed(() => {
    if (!$cwa.auth.isAdmin.value || $cwa.resources.isLoading.value) {
      return { stranded: [], shown: [] }
    }
    return findStrandedComponentGroups($cwa, componentGroupDeclarations)
  })

  return {
    stranded: computed(() => report.value.stranded),
    shown: computed(() => report.value.shown),
  }
}

function endSortValue($cwa: Cwa, groupIri: string): number {
  const sortValues = orderedPositionIris($cwa, groupIri)
    .map(iri => $cwa.resources.getResource(iri).value?.data?.sortValue)
    .filter((sortValue): sortValue is number => typeof sortValue === 'number')
  if (!sortValues.length) {
    return 0
  }
  return Math.max(Math.max(...sortValues), Math.min(...sortValues) + sortValues.length - 1) + 1
}

export async function mergeComponentGroup($cwa: Cwa, sourceIri: string, targetIri: string): Promise<{ failed: string[], sourceDeleted: boolean }> {
  if (sourceIri === targetIri) {
    return { failed: [], sourceDeleted: false }
  }
  const failed: string[] = []
  let sortValue = endSortValue($cwa, targetIri)
  for (const positionIri of orderedPositionIris($cwa, sourceIri)) {
    const moved = await $cwa.resourcesManager.updateResource({
      endpoint: positionIri,
      data: { componentGroup: targetIri, sortValue },
      refreshEndpoints: [targetIri, sourceIri],
    })
    if (!moved) {
      failed.push(positionIri)
      continue
    }
    sortValue++
  }
  if (failed.length) {
    return { failed, sourceDeleted: false }
  }
  await $cwa.resourcesManager.deleteResource({ endpoint: sourceIri }, true)
  return { failed, sourceDeleted: !$cwa.resources.getResource(sourceIri).value }
}

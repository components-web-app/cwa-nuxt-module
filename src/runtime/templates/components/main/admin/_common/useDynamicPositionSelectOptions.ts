import type { SelectOption } from '#cwa/composables/cwa-select-input'
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'
import type Cwa from '#cwa/cwa'

function toReadableLabel(str: string): string {
  return str.replace(/([A-Z])/g, ' $1').trim().replace(/^./, s => s.toUpperCase())
}

export const useDynamicPositionSelectOptions = ($cwa: Cwa) => {
  async function getTypeOptions(): Promise<SelectOption[]> {
    const docs = await $cwa.getApiDocumentation()
    const members = docs?.pageDataMetadata?.member
    if (!members) return []
    return members
      .filter((m: any) => !m.resourceClass.endsWith('\\AbstractPageData'))
      .map((m: any) => {
        const shortName = m.resourceClass.split('\\').pop() as string
        const label = $cwa.pageDataConfig?.[shortName]?.name ?? toReadableLabel(shortName)
        return { label, value: m.resourceClass }
      })
  }

  async function getPropertyOptions(resourceClass: string, allowedComponents: string[] | null): Promise<SelectOption[]> {
    const docs = await $cwa.getApiDocumentation()
    const member = docs?.pageDataMetadata?.member?.find((m: any) => m.resourceClass === resourceClass)
    if (!member) return []

    const shortName = resourceClass.split('\\').pop() as string
    const propertyLabels = $cwa.pageDataConfig?.[shortName]?.properties ?? {}

    let componentMeta: Record<string, { endpoint: string }> | undefined
    if (allowedComponents) {
      componentMeta = await $cwa.getComponentMetadata(false, false) ?? {}
      const prefix = ResourceTypeFromIri.getPathPrefix() ?? ''
      const normalizedAllowed = allowedComponents.map(iri =>
        prefix && iri.startsWith(prefix) ? iri.slice(prefix.length) : iri,
      )
      return member.properties
        .filter(({ componentShortName }: { componentShortName: string }) => {
          const endpoint = componentMeta![componentShortName]?.endpoint
          return endpoint !== undefined && normalizedAllowed.includes(endpoint)
        })
        .map(({ property }: { property: string }) => ({
          label: propertyLabels[property] ?? toReadableLabel(property),
          value: property,
        }))
    }

    return member.properties.map(({ property }: { property: string }) => ({
      label: propertyLabels[property] ?? toReadableLabel(property),
      value: property,
    }))
  }

  return { getTypeOptions, getPropertyOptions }
}

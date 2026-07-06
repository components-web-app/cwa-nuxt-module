import type { SelectOption } from '#cwa/composables/cwa-select-input'
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'
import type Cwa from '#cwa/cwa'
import { isComponentAllowedInGroup } from '#cwa/templates/components/main/admin/resource-manager/_parts/available-components'

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

    // Both branches need component metadata (#249): the allow list matches by endpoint, and an
    // unrestricted group must still exclude explicitAllowOnly (opt-in-only) component types —
    // mirroring the add dialog and the server ComponentPositionValidator.
    const componentMeta = await $cwa.getComponentMetadata(false, false) ?? {}
    const prefix = ResourceTypeFromIri.getPathPrefix() ?? ''
    const normalizedAllowed = allowedComponents
      ? allowedComponents.map(iri => prefix && iri.startsWith(prefix) ? iri.slice(prefix.length) : iri)
      : null

    return member.properties
      .filter(({ componentShortName }: { componentShortName: string }) => {
        const meta = componentMeta[componentShortName]
        // Component type not in metadata: it cannot be matched against an allow list, so only
        // offer it when the group is unrestricted (preserves prior behaviour).
        if (!meta) {
          return !normalizedAllowed
        }
        return isComponentAllowedInGroup(meta, normalizedAllowed)
      })
      .map(({ property }: { property: string }) => ({
        label: propertyLabels[property] ?? toReadableLabel(property),
        value: property,
      }))
  }

  return { getTypeOptions, getPropertyOptions }
}

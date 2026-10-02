import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type Cwa from '#cwa/cwa'
import { useCwa } from '#cwa/composables/cwa'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'

export const UNRENDERED_SETTLE_MS = 1500

export interface UnrenderedGroupPosition {
  iri: string
  component?: string
  componentType?: string
  pageDataProperty?: string
}

export interface UnrenderedComponentGroup {
  iri: string
  reference: string
  fromLayout: boolean
  positions: UnrenderedGroupPosition[]
}

export interface RenderedComponentGroup {
  iri: string
  reference: string
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

export function useUnrenderedComponentGroups() {
  const $cwa = useCwa()
  const settled = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  function clearTimer() {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  onMounted(() => {
    watch(
      [() => $cwa.resources.isLoading.value, () => $cwa.resources.displayPageIri.value],
      ([isLoading]) => {
        clearTimer()
        settled.value = false
        if (!isLoading) {
          timer = setTimeout(() => {
            settled.value = true
          }, UNRENDERED_SETTLE_MS)
        }
      },
      { immediate: true },
    )
  })

  onBeforeUnmount(() => {
    clearTimer()
  })

  const report = computed(() => {
    const unrendered: UnrenderedComponentGroup[] = []
    const rendered: RenderedComponentGroup[] = []
    if (!settled.value || !$cwa.auth.isAdmin.value) {
      return { unrendered, rendered }
    }

    const visited = new Set<string>()
    const getData = (iri: string) => $cwa.resources.getResource(iri).value?.data

    const visit = (groupIri: string, fromLayout: boolean) => {
      if (visited.has(groupIri)) {
        return
      }
      visited.add(groupIri)
      const group = getData(groupIri)
      if (!group) {
        return
      }
      const positionIris = orderedPositionIris($cwa, groupIri)
      if (!$cwa.admin.isComponentGroupMounted(groupIri)) {
        unrendered.push({
          iri: groupIri,
          reference: shortReference(group),
          fromLayout,
          positions: positionIris.map((positionIri) => {
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
        return
      }
      rendered.push({ iri: groupIri, reference: shortReference(group) })
      for (const positionIri of positionIris) {
        const component = getData(positionIri)?.component
        if (typeof component !== 'string') {
          continue
        }
        for (const componentIri of $cwa.resources.findAllPublishableIris(component)) {
          for (const childGroupIri of iriList(getData(componentIri)?.componentGroups)) {
            visit(childGroupIri, fromLayout)
          }
        }
      }
    }

    const depthCount = $cwa.resources.depthCount.value
    for (let depth = 0; depth < depthCount; depth++) {
      for (const groupIri of iriList($cwa.resources.pageAtDepth(depth).value?.data?.componentGroups)) {
        visit(groupIri, false)
      }
    }
    for (const groupIri of iriList($cwa.resources.layout.value?.data?.componentGroups)) {
      visit(groupIri, true)
    }

    return { unrendered, rendered }
  })

  return {
    unrendered: computed(() => report.value.unrendered),
    rendered: computed(() => report.value.rendered),
    warningCount: computed(() => report.value.unrendered.filter(group => !group.fromLayout).length),
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

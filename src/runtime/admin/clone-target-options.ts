import { CwaResourceTypes, getResourceTypeFromIri, ResourceTypeFromIri } from '../resources/resource-utils'
import { componentGroupCapacity } from '../resources/component-group-capacity'
import type { Resources } from '../resources/resources'
import type { ApiDocumentationComponentMetadataCollection } from '../api/api-documentation'
import type { CloneAnchor, CloneTarget } from './clone-component'
import type { CloneMove } from './clone-mode'
import { isComponentAllowedInGroup } from '#cwa/templates/components/main/admin/resource-manager/_parts/available-components'

export type CloneScope = 'layout' | 'page'

export interface CloneTargetOption {
  label: string
  value: CloneTarget
  disabled: boolean
  reasons: string[]
}

export interface CloneTargetOptionsInput {
  stack: { iri: string }[]
  sourceIri: string
  sourceType: string | undefined
  componentMetadata: ApiDocumentationComponentMetadataCollection
  resources: Pick<Resources, 'getResource' | 'getChildIris' | 'findAllPublishableIris' | 'pageDataIriOf' | 'getOrderedPositionsForGroup'>
  isDataPage: boolean
  isEditingLayout: boolean
  type: CloneScope
  move?: CloneMove
}

export interface CloneTargetOptions {
  options: CloneTargetOption[]
  scope?: { type: CloneScope, switching: boolean }
  leavesLayout?: true
}

function withoutPrefix(iri: string) {
  const prefix = ResourceTypeFromIri.getPathPrefix()
  return prefix && iri.startsWith(prefix) ? iri.slice(prefix.length) : iri
}

function resolveSourceType({ sourceIri, sourceType, componentMetadata }: CloneTargetOptionsInput) {
  if (sourceType) {
    return sourceType
  }
  const path = withoutPrefix(sourceIri)
  return Object.keys(componentMetadata).find(name => path.startsWith(`${componentMetadata[name]!.endpoint}/`))
}

function indexOfType(stack: { iri: string }[], type: CwaResourceTypes) {
  return stack.findIndex(item => getResourceTypeFromIri(item.iri) === type)
}

function isInsideSource(input: CloneTargetOptionsInput, containerIndex: number) {
  const sourceIris = input.resources.findAllPublishableIris(input.sourceIri)
  if (input.stack.slice(containerIndex).some(item => sourceIris.includes(item.iri))) {
    return true
  }
  const containerIri = input.stack[containerIndex]!.iri
  return sourceIris.some(iri => input.resources.getChildIris(iri, undefined).includes(containerIri))
}

function groupReasons(input: CloneTargetOptionsInput, groupIndex: number, typeName: string | undefined) {
  const groupIri = input.stack[groupIndex]!.iri
  const group = input.resources.getResource(groupIri).value?.data
  const reasons: string[] = []
  const movingWithinGroup = !!input.move && input.resources.getResource(input.move.positionIri).value?.data?.componentGroup === groupIri
  if (componentGroupCapacity(group).full && !movingWithinGroup) {
    reasons.push('This group is full')
  }
  const meta = typeName ? input.componentMetadata[typeName] : undefined
  if (!meta) {
    reasons.push('This component type is not known')
  }
  else {
    const allowed: string[] | null | undefined = group?.allowedComponents
    if (!isComponentAllowedInGroup(meta, allowed?.map(withoutPrefix))) {
      reasons.push(`This group does not allow ${typeName}`)
    }
  }
  if (isInsideSource(input, groupIndex)) {
    reasons.push(insideSourceReason(input))
  }
  return reasons
}

function insideSourceReason(input: CloneTargetOptionsInput) {
  return `This is inside the component being ${input.move ? 'moved' : 'cloned'}`
}

function anchorReasons(input: CloneTargetOptionsInput, reasons: string[], anchor: CloneAnchor) {
  const anchorIri = 'after' in anchor ? anchor.after : 'before' in anchor ? anchor.before : undefined
  return input.move && anchorIri === input.move.positionIri ? [...reasons, 'This is where it already is'] : reasons
}

function option(label: string, value: CloneTarget, reasons: string[]): CloneTargetOption {
  return { label, value, disabled: reasons.length > 0, reasons }
}

function groupOptions(input: CloneTargetOptionsInput, typeName: string | undefined): CloneTargetOption[] {
  const groupIndex = indexOfType(input.stack, CwaResourceTypes.COMPONENT_GROUP)
  if (groupIndex === -1) {
    return []
  }
  const groupIri = input.stack[groupIndex]!.iri
  const reasons = groupReasons(input, groupIndex, typeName)
  const at = (anchor: CloneAnchor): CloneTarget => ({ kind: 'position', groupIri, anchor })

  if (groupIndex === 0) {
    const first = input.resources.getOrderedPositionsForGroup(groupIri, false)?.[0]
    if (!first) {
      return [option('Add here', at({}), reasons)]
    }
    return [
      option('Add to Start', at({ before: first }), anchorReasons(input, reasons, { before: first })),
      option('Add to End', at({}), reasons),
    ]
  }

  const positionIndex = indexOfType(input.stack.slice(0, groupIndex), CwaResourceTypes.COMPONENT_POSITION)
  if (positionIndex === -1) {
    return []
  }
  const positionIri = input.stack[positionIndex]!.iri
  return [
    option('Add before', at({ before: positionIri }), anchorReasons(input, reasons, { before: positionIri })),
    option('Add after', at({ after: positionIri }), anchorReasons(input, reasons, { after: positionIri })),
  ]
}

function pageDataOptions(input: CloneTargetOptionsInput, typeName: string | undefined): CloneTargetOption[] {
  if (!input.isDataPage) {
    return []
  }
  const groupIndex = indexOfType(input.stack, CwaResourceTypes.COMPONENT_GROUP)
  const positionIndex = indexOfType(groupIndex === -1 ? input.stack : input.stack.slice(0, groupIndex), CwaResourceTypes.COMPONENT_POSITION)
  if (positionIndex === -1) {
    return []
  }
  const positionIri = input.stack[positionIndex]!.iri
  const property: string | undefined = input.resources.getResource(positionIri).value?.data?.pageDataProperty
  if (!property) {
    return []
  }
  const pageDataIri = input.resources.pageDataIriOf(positionIri).value
  const properties: { property: string, componentShortName: string }[] = (pageDataIri && input.resources.getResource(pageDataIri).value?.data?._metadata?.pageDataMetadata?.properties) || []
  const fieldType = properties.find(item => item.property === property)?.componentShortName
  const reasons: string[] = []
  if (input.move) {
    return [option('Use here', { kind: 'page-data', positionIri, property }, ['Moving into a page-data slot is not supported yet'])]
  }
  if (!typeName || fieldType !== typeName) {
    reasons.push(`This field takes ${fieldType ?? 'another type'}, not ${typeName ?? 'this component'}`)
  }
  if (isInsideSource(input, positionIndex)) {
    reasons.push(insideSourceReason(input))
  }
  return [option('Use here', { kind: 'page-data', positionIri, property }, reasons)]
}

export function cloneTargetOptions(input: CloneTargetOptionsInput): CloneTargetOptions {
  const typeName = resolveSourceType(input)
  const options = [...groupOptions(input, typeName), ...pageDataOptions(input, typeName)]
  const result: CloneTargetOptions = { options }
  const switching = (input.type === 'layout') !== input.isEditingLayout
  if (switching || input.type === 'layout') {
    result.scope = { type: input.type, switching }
  }
  if (input.move?.fromLayout && input.type === 'page') {
    result.leavesLayout = true
  }
  return result
}

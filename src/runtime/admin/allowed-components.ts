import { consola as logger } from 'consola'
import { ResourceTypeFromIri } from '../resources/resource-utils'
import type { ApiDocumentationComponentMetadataCollection } from '../api/api-documentation'

export interface AllowedComponentRule {
  component: string
  ui?: string[]
  styles?: string[]
}

export type AllowedComponentEntry = string | AllowedComponentRule

export type AllowedComponentUi = Record<string, { ui?: (string | null)[], styles?: string[] }>

export interface ResolvedAllowedComponents {
  allowedComponents: string[] | null
  allowedComponentUi: AllowedComponentUi | null
}

const warnedIriEntries = new Set<string>()

function isRule(entry: unknown): entry is AllowedComponentRule {
  return !!entry && typeof entry === 'object' && typeof (entry as AllowedComponentRule).component === 'string'
}

export async function resolveAllowedComponents(
  allowedComponents: AllowedComponentEntry[] | null,
  getComponentMetadata: () => Promise<ApiDocumentationComponentMetadataCollection | undefined>,
): Promise<ResolvedAllowedComponents | undefined> {
  if (!allowedComponents?.length) return { allowedComponents: null, allowedComponentUi: null }

  const invalid = allowedComponents.filter(entry => typeof entry !== 'string' && !isRule(entry))
  if (invalid.length) {
    logger.warn(`[CWA] allowedComponents was not synced: ${invalid.map(String).join(', ')} is not a component name.`)
    return
  }

  const nameOf = (entry: AllowedComponentEntry) => isRule(entry) ? entry.component : entry
  for (const entry of allowedComponents) {
    const name = nameOf(entry)
    if (name.startsWith('/') && !warnedIriEntries.has(name)) {
      warnedIriEntries.add(name)
      logger.warn(`[CWA] The allowedComponents entry '${name}' is a collection IRI, the old syntax. Use the component name, from CwaComponentNames. IRIs will stop working in the next alpha, without further warning.`)
    }
  }

  const names = allowedComponents.map(nameOf).filter(name => !name.startsWith('/'))
  let endpoints: Record<string, string> = {}
  if (names.length) {
    const metadata = await getComponentMetadata()
    if (!metadata) {
      return
    }
    const unknown = names.filter(name => !metadata[name])
    if (unknown.length) {
      logger.warn(`[CWA] allowedComponents was not synced: the API has no component named ${unknown.join(', ')}.`)
      return
    }
    endpoints = Object.fromEntries(names.map(name => [name, metadata[name]!.endpoint]))
  }

  const prefix = ResourceTypeFromIri.getPathPrefix()
  const iriOf = (name: string) => {
    const iri = endpoints[name] ?? name
    return prefix && !iri.startsWith(prefix) ? `${prefix}${iri}` : iri
  }

  const allowedComponentUi: AllowedComponentUi = {}
  for (const rule of allowedComponents.filter(isRule)) {
    const restriction: AllowedComponentUi[string] = {}
    if (rule.ui?.length) {
      restriction.ui = rule.ui.map(ui => ui === `CwaComponent${rule.component}` ? null : ui)
    }
    if (rule.styles?.length) {
      restriction.styles = rule.styles.map(style => `style:${style}`)
    }
    if (Object.keys(restriction).length) {
      allowedComponentUi[iriOf(rule.component)] = restriction
    }
  }

  return {
    allowedComponents: allowedComponents.map(entry => iriOf(nameOf(entry))),
    allowedComponentUi: Object.keys(allowedComponentUi).length ? allowedComponentUi : null,
  }
}

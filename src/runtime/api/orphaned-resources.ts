import type CwaFetch from '#cwa/api/fetcher/cwa-fetch'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'

export interface OrphanedResourceReport {
  generatedAt: string
  componentGroups: string[]
  componentPositions: string[]
  components: string[]
}

export type OrphanedResourceKind = 'componentGroups' | 'componentPositions' | 'components'

export type OrphanedResourceDeletionRequest = { iris: string[], all?: never } | { all: true, iris?: never }

export interface OrphanedResourceRejection {
  iri: string
  reason: 'not_orphaned' | 'not_found'
}

export interface OrphanedResourceDeletionResult {
  deleted: Record<OrphanedResourceKind, string[]>
  rejected: OrphanedResourceRejection[]
}

function emptyDeletionResult(): OrphanedResourceDeletionResult {
  return { deleted: { componentGroups: [], componentPositions: [], components: [] }, rejected: [] }
}

function deletionBody(request: OrphanedResourceDeletionRequest): { iris: string[] } | { all: true } | undefined {
  if (Array.isArray(request.iris)) {
    return request.iris.length ? { iris: [...request.iris] } : undefined
  }
  return request.all === true ? { all: true } : undefined
}

export function orphanedResourceEndpoint(iri: string): string {
  return getResourceTypeFromIri(iri) === CwaResourceTypes.COMPONENT ? `${iri}?published=true` : iri
}

export default class OrphanedResources {
  constructor(private readonly cwaFetch: CwaFetch) {}

  public fetchReport(): Promise<OrphanedResourceReport> {
    return this.cwaFetch.fetch<OrphanedResourceReport>('/_/orphaned_resources')
  }

  public async requestScan(): Promise<void> {
    const { method, headers } = this.cwaFetch.getRequestOptions('POST')
    await this.cwaFetch.fetch('/_/orphaned_resources/scan', {
      method,
      headers: headers as Record<string, string>,
    })
  }

  public async deleteOrphans(request: OrphanedResourceDeletionRequest): Promise<OrphanedResourceDeletionResult> {
    const body = deletionBody(request)
    if (!body) {
      return emptyDeletionResult()
    }
    const { method, headers } = this.cwaFetch.getRequestOptions('POST')
    return await this.cwaFetch.fetch<OrphanedResourceDeletionResult>('/_/orphaned_resources/delete', {
      method,
      headers: headers as Record<string, string>,
      body,
    })
  }
}

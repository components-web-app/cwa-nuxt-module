import type CwaFetch from '#cwa/api/fetcher/cwa-fetch'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'

export interface OrphanedResourceReport {
  generatedAt: string
  componentGroups: string[]
  componentPositions: string[]
  components: string[]
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

  public async deleteResource(iri: string): Promise<void> {
    const { method, headers } = this.cwaFetch.getRequestOptions('DELETE')
    await this.cwaFetch.fetch(orphanedResourceEndpoint(iri), {
      method,
      headers: headers as Record<string, string>,
    })
  }
}

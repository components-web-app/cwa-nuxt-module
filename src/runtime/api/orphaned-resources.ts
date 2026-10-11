import type CwaFetch from '#cwa/api/fetcher/cwa-fetch'
import { lazyImport } from '#cwa/lazy-import'
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

export interface OrphanedFile {
  adapter: string
  path: string
}

export interface MissingFile extends OrphanedFile {
  resource: string
}

export interface InvalidFile extends MissingFile {
  field: string
  violations: string[]
}

export interface OrphanedFileReport {
  generatedAt: string
  orphanedFiles: OrphanedFile[]
  unknownFiles?: OrphanedFile[]
  missingFiles: MissingFile[]
  invalidFiles?: InvalidFile[]
}

export type OrphanedFileDeletionRequest = { paths: string[], all?: never } | { all: true, paths?: never }

export interface OrphanedFileRejection {
  path: string
  reason: 'not_orphaned' | 'not_found' | 'delete_failed' | 'unknown'
}

export interface OrphanedFileDeletionResult {
  deleted: OrphanedFile[]
  rejected: OrphanedFileRejection[]
}

export function orphanedResourceEndpoint(iri: string): string {
  return getResourceTypeFromIri(iri) === CwaResourceTypes.COMPONENT ? `${iri}?published=true` : iri
}

export default class OrphanedResources {
  private readonly requests = lazyImport(() => import('#cwa/api/orphaned-resource-requests').then(({ default: OrphanedResourceRequests }) => new OrphanedResourceRequests(this.cwaFetch)))

  constructor(private readonly cwaFetch: CwaFetch) {}

  public async fetchReport(): Promise<OrphanedResourceReport> {
    return (await this.requests.load()).fetchReport()
  }

  public async requestScan(): Promise<void> {
    return (await this.requests.load()).requestScan()
  }

  public async deleteOrphans(request: OrphanedResourceDeletionRequest): Promise<OrphanedResourceDeletionResult> {
    return (await this.requests.load()).deleteOrphans(request)
  }

  public async fetchFileReport(): Promise<OrphanedFileReport> {
    return (await this.requests.load()).fetchFileReport()
  }

  public async requestFileScan(): Promise<void> {
    return (await this.requests.load()).requestFileScan()
  }

  public async deleteOrphanedFiles(request: OrphanedFileDeletionRequest): Promise<OrphanedFileDeletionResult> {
    return (await this.requests.load()).deleteOrphanedFiles(request)
  }
}

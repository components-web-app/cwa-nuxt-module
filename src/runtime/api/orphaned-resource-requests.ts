import type CwaFetch from '#cwa/api/fetcher/cwa-fetch'
import type {
  OrphanedFileDeletionRequest,
  OrphanedFileDeletionResult,
  OrphanedFileReport,
  OrphanedResourceDeletionRequest,
  OrphanedResourceDeletionResult,
  OrphanedResourceReport,
} from '#cwa/api/orphaned-resources'

function emptyDeletionResult(): OrphanedResourceDeletionResult {
  return { deleted: { componentGroups: [], componentPositions: [], components: [] }, rejected: [] }
}

function deletionBody<K extends 'iris' | 'paths'>(key: K, selected: unknown, all: unknown): Record<K, string[]> | { all: true } | undefined {
  if (Array.isArray(selected)) {
    return selected.length ? { [key]: [...new Set<string>(selected)] } as Record<K, string[]> : undefined
  }
  return all === true ? { all: true } : undefined
}

export default class OrphanedResourceRequests {
  constructor(private readonly cwaFetch: CwaFetch) {}

  public fetchReport(): Promise<OrphanedResourceReport> {
    return this.cwaFetch.fetch<OrphanedResourceReport>('/_/orphaned_resources')
  }

  public async requestScan(): Promise<void> {
    await this.post('/_/orphaned_resources/scan')
  }

  public async deleteOrphans(request: OrphanedResourceDeletionRequest): Promise<OrphanedResourceDeletionResult> {
    const body = deletionBody('iris', request.iris, request.all)
    if (!body) {
      return emptyDeletionResult()
    }
    return await this.post<OrphanedResourceDeletionResult>('/_/orphaned_resources/delete', body)
  }

  public fetchFileReport(): Promise<OrphanedFileReport> {
    return this.cwaFetch.fetch<OrphanedFileReport>('/_/orphaned_files')
  }

  public async requestFileScan(): Promise<void> {
    await this.post('/_/orphaned_files/scan')
  }

  public async deleteOrphanedFiles(request: OrphanedFileDeletionRequest): Promise<OrphanedFileDeletionResult> {
    const body = deletionBody('paths', request.paths, request.all)
    if (!body) {
      return { deleted: [], rejected: [] }
    }
    return await this.post<OrphanedFileDeletionResult>('/_/orphaned_files/delete', body)
  }

  private post<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    const { method, headers } = this.cwaFetch.getRequestOptions('POST')
    return this.cwaFetch.fetch<T>(path, {
      method,
      headers: headers as Record<string, string>,
      ...(body ? { body } : {}),
    })
  }
}

import { afterEach, describe, expect, test, vi } from 'vitest'
import OrphanedResources, { orphanedResourceEndpoint } from '#cwa/api/orphaned-resources'
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'

function buildService() {
  const mockFetch = vi.fn().mockResolvedValue(undefined)
  const mockGetRequestOptions = vi.fn((method: string) => ({ method, headers: { accept: 'application/ld+json,application/json' } }))
  const service = new OrphanedResources({ fetch: mockFetch, getRequestOptions: mockGetRequestOptions } as any)
  return { service, mockFetch, mockGetRequestOptions }
}

describe('OrphanedResources', () => {
  afterEach(() => {
    ResourceTypeFromIri.setPathPrefix(undefined)
  })

  test('fetches the stored report', async () => {
    const { service, mockFetch } = buildService()
    const report = { generatedAt: '2026-09-25T10:00:00+00:00', components: [], componentPositions: [], componentGroups: [] }
    mockFetch.mockResolvedValueOnce(report)
    await expect(service.fetchReport()).resolves.toBe(report)
    expect(mockFetch).toHaveBeenCalledWith('/_/orphaned_resources')
  })

  test('rejects with the fetch error when no report has been stored', async () => {
    const { service, mockFetch } = buildService()
    const error = Object.assign(new Error('Not Found'), { statusCode: 404 })
    mockFetch.mockRejectedValueOnce(error)
    await expect(service.fetchReport()).rejects.toBe(error)
  })

  test('requests a scan with a POST and no body', async () => {
    const { service, mockFetch, mockGetRequestOptions } = buildService()
    await service.requestScan()
    expect(mockGetRequestOptions).toHaveBeenCalledWith('POST')
    expect(mockFetch).toHaveBeenCalledWith('/_/orphaned_resources/scan', { method: 'POST', headers: { accept: 'application/ld+json,application/json' } })
    expect(mockFetch.mock.calls[0]![1]).not.toHaveProperty('body')
  })

  describe('deleting orphans', () => {
    const result = {
      deleted: { componentGroups: [], componentPositions: [], components: ['/component/html_contents/abc'] },
      rejected: [{ iri: '/_/component_groups/abc', reason: 'not_found' }],
    }

    test('posts the selected IRIs to the bulk delete endpoint and returns its result', async () => {
      const { service, mockFetch, mockGetRequestOptions } = buildService()
      mockFetch.mockResolvedValueOnce(result)
      await expect(service.deleteOrphans({ iris: ['/component/html_contents/abc', '/_/component_groups/abc'] })).resolves.toBe(result)
      expect(mockGetRequestOptions).toHaveBeenCalledWith('POST')
      expect(mockFetch).toHaveBeenCalledWith('/_/orphaned_resources/delete', {
        method: 'POST',
        headers: { accept: 'application/ld+json,application/json' },
        body: { iris: ['/component/html_contents/abc', '/_/component_groups/abc'] },
      })
    })

    test('sends IRIs as they are, leaving the API to resolve which version is orphaned', async () => {
      const { service, mockFetch } = buildService()
      await service.deleteOrphans({ iris: ['/component/html_contents/abc'] })
      expect(mockFetch.mock.calls[0]![1].body).toEqual({ iris: ['/component/html_contents/abc'] })
    })

    test('asks for everything with all set to true', async () => {
      const { service, mockFetch } = buildService()
      await service.deleteOrphans({ all: true })
      expect(mockFetch).toHaveBeenCalledWith('/_/orphaned_resources/delete', {
        method: 'POST',
        headers: { accept: 'application/ld+json,application/json' },
        body: { all: true },
      })
    })

    test('an empty IRI list sends no request and deletes nothing', async () => {
      const { service, mockFetch } = buildService()
      await expect(service.deleteOrphans({ iris: [] })).resolves.toEqual({
        deleted: { componentGroups: [], componentPositions: [], components: [] },
        rejected: [],
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    test('a body with neither IRIs nor all set to true sends no request', async () => {
      const { service, mockFetch } = buildService()
      await service.deleteOrphans({} as any)
      await service.deleteOrphans({ all: false } as any)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    test('a body naming IRIs and all together deletes only the IRIs, never everything', async () => {
      const { service, mockFetch } = buildService()
      await service.deleteOrphans({ iris: ['/_/component_groups/abc'], all: true } as any)
      expect(mockFetch.mock.calls[0]![1].body).toEqual({ iris: ['/_/component_groups/abc'] })
    })

    test('rejects with the fetch error when the delete fails', async () => {
      const { service, mockFetch } = buildService()
      const error = Object.assign(new Error('Unprocessable'), { statusCode: 422 })
      mockFetch.mockRejectedValueOnce(error)
      await expect(service.deleteOrphans({ all: true })).rejects.toBe(error)
    })
  })

  describe('orphaned files', () => {
    const headers = { accept: 'application/ld+json,application/json' }

    test('fetches the stored file report', async () => {
      const { service, mockFetch } = buildService()
      const report = { generatedAt: '2026-09-25T10:00:00.123456+00:00', orphanedFiles: [], missingFiles: [] }
      mockFetch.mockResolvedValueOnce(report)
      await expect(service.fetchFileReport()).resolves.toBe(report)
      expect(mockFetch).toHaveBeenCalledWith('/_/orphaned_files')
    })

    test('rejects with the fetch error when no file report has been stored', async () => {
      const { service, mockFetch } = buildService()
      const error = Object.assign(new Error('Not Found'), { statusCode: 404 })
      mockFetch.mockRejectedValueOnce(error)
      await expect(service.fetchFileReport()).rejects.toBe(error)
    })

    test('requests a file scan with a POST and no body', async () => {
      const { service, mockFetch, mockGetRequestOptions } = buildService()
      await service.requestFileScan()
      expect(mockGetRequestOptions).toHaveBeenCalledWith('POST')
      expect(mockFetch).toHaveBeenCalledWith('/_/orphaned_files/scan', { method: 'POST', headers })
      expect(mockFetch.mock.calls[0]![1]).not.toHaveProperty('body')
    })

    test('posts the selected paths to the file delete endpoint and returns its result', async () => {
      const { service, mockFetch } = buildService()
      const result = { deleted: [{ adapter: 'local', path: 'files/a.png' }], rejected: [{ path: 'files/b.png', reason: 'delete_failed' }] }
      mockFetch.mockResolvedValueOnce(result)
      await expect(service.deleteOrphanedFiles({ paths: ['files/a.png', 'files/b.png'] })).resolves.toBe(result)
      expect(mockFetch).toHaveBeenCalledWith('/_/orphaned_files/delete', { method: 'POST', headers, body: { paths: ['files/a.png', 'files/b.png'] } })
    })

    test('a path listed on more than one adapter is sent once', async () => {
      const { service, mockFetch } = buildService()
      await service.deleteOrphanedFiles({ paths: ['files/a.png', 'files/a.png'] })
      expect(mockFetch.mock.calls[0]![1].body).toEqual({ paths: ['files/a.png'] })
    })

    test('asks for every orphaned file with all set to true', async () => {
      const { service, mockFetch } = buildService()
      await service.deleteOrphanedFiles({ all: true })
      expect(mockFetch).toHaveBeenCalledWith('/_/orphaned_files/delete', { method: 'POST', headers, body: { all: true } })
    })

    test('an empty path list, or a body with neither paths nor all set to true, sends no request', async () => {
      const { service, mockFetch } = buildService()
      await expect(service.deleteOrphanedFiles({ paths: [] })).resolves.toEqual({ deleted: [], rejected: [] })
      await service.deleteOrphanedFiles({} as any)
      await service.deleteOrphanedFiles({ all: false } as any)
      await service.deleteOrphanedFiles({ all: 'true' } as any)
      await service.deleteOrphanedFiles({ iris: ['files/a.png'] } as any)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    test('a body naming paths and all together deletes only the paths, never everything', async () => {
      const { service, mockFetch } = buildService()
      await service.deleteOrphanedFiles({ paths: ['files/a.png'], all: true } as any)
      expect(mockFetch.mock.calls[0]![1].body).toEqual({ paths: ['files/a.png'] })
    })

    test('rejects with the fetch error when the delete fails', async () => {
      const { service, mockFetch } = buildService()
      const error = Object.assign(new Error('Unprocessable'), { statusCode: 422 })
      mockFetch.mockRejectedValueOnce(error)
      await expect(service.deleteOrphanedFiles({ all: true })).rejects.toBe(error)
    })
  })

  describe('orphanedResourceEndpoint', () => {
    test('asks for the published version of a component', () => {
      expect(orphanedResourceEndpoint('/component/html_contents/abc')).toBe('/component/html_contents/abc?published=true')
    })

    test('asks for the published version of a component under an API path prefix', () => {
      ResourceTypeFromIri.setPathPrefix('/_api')
      expect(orphanedResourceEndpoint('/_api/component/html_contents/abc')).toBe('/_api/component/html_contents/abc?published=true')
    })

    test('leaves groups and positions as they are, since they are never publishable', () => {
      expect(orphanedResourceEndpoint('/_/component_groups/abc')).toBe('/_/component_groups/abc')
      expect(orphanedResourceEndpoint('/_/component_positions/abc')).toBe('/_/component_positions/abc')
    })
  })
})

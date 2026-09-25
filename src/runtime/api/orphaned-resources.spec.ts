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

  test('deletes a resource at its endpoint', async () => {
    const { service, mockFetch, mockGetRequestOptions } = buildService()
    await service.deleteResource('/_/component_groups/abc')
    expect(mockGetRequestOptions).toHaveBeenCalledWith('DELETE')
    expect(mockFetch).toHaveBeenCalledWith('/_/component_groups/abc', { method: 'DELETE', headers: { accept: 'application/ld+json,application/json' } })
  })

  test('deletes the published version of a component, never a draft the API would otherwise resolve to', async () => {
    const { service, mockFetch } = buildService()
    await service.deleteResource('/component/html_contents/abc')
    expect(mockFetch.mock.calls[0]![0]).toBe('/component/html_contents/abc?published=true')
  })

  test('rejects with the fetch error when a delete fails', async () => {
    const { service, mockFetch } = buildService()
    const error = Object.assign(new Error('Server Error'), { statusCode: 500 })
    mockFetch.mockRejectedValueOnce(error)
    await expect(service.deleteResource('/_/component_positions/abc')).rejects.toBe(error)
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

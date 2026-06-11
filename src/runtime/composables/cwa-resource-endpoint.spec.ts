// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import * as cwaComposable from '#cwa/composables/cwa'
import * as resourceUtils from '#cwa/resources/resource-utils'
import { useCwaResourceEndpoint } from '#cwa/composables/cwa-resource-endpoint'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    onBeforeUnmount: vi.fn(),
  }
})

vi.mock('#cwa/resources/resource-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof resourceUtils>()
  return {
    ...actual,
    getPublishedResourceState: vi.fn(() => false),
  }
})

describe('useCwaResourceEndpoint', () => {
  const forcePublishedVersion = ref<boolean | undefined>(undefined)
  const mockResource = ref<any>(undefined)
  const mockCwa = {
    resources: {
      getResource: vi.fn(() => mockResource),
    },
    admin: {
      resourceStackManager: { forcePublishedVersion },
      isEditing: false,
    },
  }

  beforeEach(() => {
    vi.spyOn(cwaComposable, 'useCwa').mockReturnValue(mockCwa)
    forcePublishedVersion.value = undefined
    mockResource.value = undefined
    mockCwa.admin.isEditing = false
    vi.mocked(resourceUtils.getPublishedResourceState).mockReturnValue(false)
  })

  test('endpoint returns iri when resource does not exist', () => {
    const iri = ref<string | undefined>('/my/resource')
    const { endpoint } = useCwaResourceEndpoint(iri)
    expect(endpoint.value).toBe('/my/resource')
  })

  test('endpoint appends postfix when provided', () => {
    const iri = ref<string | undefined>('/my/resource')
    const { endpoint } = useCwaResourceEndpoint(iri, '/sub')
    expect(endpoint.value).toBe('/my/resource/sub')
  })

  test('endpoint has no query when resource is not publishable', () => {
    const iri = ref<string | undefined>('/my/resource')
    mockResource.value = { data: { '@id': '/my/resource', '@type': 'Component' } }
    vi.mocked(resourceUtils.getPublishedResourceState).mockReturnValue(false)

    const { endpoint, query } = useCwaResourceEndpoint(iri)
    expect(query.value).toBe('')
    expect(endpoint.value).toBe('/my/resource')
  })

  test('query is ?published=true when resource is publishable and not editing', () => {
    const iri = ref<string | undefined>('/my/resource')
    mockResource.value = { data: { '@id': '/my/resource', '@type': 'Component' } }
    mockCwa.admin.isEditing = false
    vi.mocked(resourceUtils.getPublishedResourceState).mockReturnValue(true)

    const { query } = useCwaResourceEndpoint(iri)
    expect(query.value).toBe('?published=true')
  })

  test('query is ?published=false when resource is publishable, editing, and force published is set', () => {
    const iri = ref<string | undefined>('/my/resource')
    mockResource.value = { data: { '@id': '/my/resource', '@type': 'Component' } }
    mockCwa.admin.isEditing = true
    forcePublishedVersion.value = false
    vi.mocked(resourceUtils.getPublishedResourceState).mockReturnValue(true)

    const { query } = useCwaResourceEndpoint(iri)
    expect(query.value).toBe('?published=false')
  })

  test('query is empty when resource is publishable but admin is editing and no forcePublishedVersion', () => {
    const iri = ref<string | undefined>('/my/resource')
    mockResource.value = { data: { '@id': '/my/resource', '@type': 'Component' } }
    mockCwa.admin.isEditing = true
    forcePublishedVersion.value = undefined
    vi.mocked(resourceUtils.getPublishedResourceState).mockReturnValue(true)

    const { query } = useCwaResourceEndpoint(iri)
    expect(query.value).toBe('')
  })

  test('endpoint combines iri, postfix, and query', () => {
    const iri = ref<string | undefined>('/my/resource')
    mockResource.value = { data: { '@id': '/my/resource', '@type': 'Component' } }
    mockCwa.admin.isEditing = false
    vi.mocked(resourceUtils.getPublishedResourceState).mockReturnValue(true)

    const { endpoint } = useCwaResourceEndpoint(iri, '/sub')
    expect(endpoint.value).toBe('/my/resource/sub?published=true')
  })
})

// @vitest-environment nuxt
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import ManagerTabsResolver from '#cwa/admin/manager-tabs-resolver'
import { CwaResourceTypes } from '#cwa/resources/resource-utils'
import type { CwaCurrentResourceInterface } from '#cwa/storage/stores/resources/state'

// vi.hoisted runs before imports — use plain objects instead of Vue refs
const mockIsDataPage = vi.hoisted(() => ({ value: false }))
const mockIsDynamicPage = vi.hoisted(() => ({ value: false }))

mockNuxtImport('useCwa', () => () => ({
  resources: {
    isDataPage: mockIsDataPage,
    isDynamicPage: mockIsDynamicPage,
  },
}))

function makeResource(publishablePublished?: boolean): CwaCurrentResourceInterface {
  return {
    data: {
      '@id': '/components/1',
      '@type': 'Component',
      '_metadata': {
        persisted: true,
        ...(publishablePublished !== undefined
          ? { publishable: { published: publishablePublished, publishedAt: '2025-01-01' } }
          : {}),
      },
    },
  }
}

describe('ManagerTabsResolver', () => {
  beforeEach(() => {
    mockIsDataPage.value = false
    mockIsDynamicPage.value = false
  })

  describe('resolve', () => {
    test('always includes ResourceInfoTab as first tab', () => {
      const resolver = new ManagerTabsResolver()
      const tabs = resolver.resolve({ resource: makeResource() })
      expect(tabs).toHaveLength(1)
    })

    test('adds resourceConfig.managerTabs to tabs', () => {
      const resolver = new ManagerTabsResolver()
      const extraTab = vi.fn()
      const tabs = resolver.resolve({
        resource: makeResource(),
        resourceConfig: { managerTabs: [extraTab as any] },
      })
      expect(tabs).toHaveLength(2)
    })

    test('COMPONENT_GROUP adds one group tab', () => {
      const resolver = new ManagerTabsResolver()
      const tabs = resolver.resolve({
        resourceType: CwaResourceTypes.COMPONENT_GROUP,
        resource: makeResource(),
      })
      expect(tabs).toHaveLength(2)
    })

    test('COMPONENT_POSITION with no special page state adds no extra tabs', () => {
      const resolver = new ManagerTabsResolver()
      const tabs = resolver.resolve({
        resourceType: CwaResourceTypes.COMPONENT_POSITION,
        resource: makeResource(),
      })
      expect(tabs).toHaveLength(1)
    })

    test('COMPONENT_POSITION with isDynamicPage adds DynamicPage tab', () => {
      mockIsDynamicPage.value = true
      const resolver = new ManagerTabsResolver()
      const tabs = resolver.resolve({
        resourceType: CwaResourceTypes.COMPONENT_POSITION,
        resource: {
          data: {
            '@id': '/positions/1',
            '@type': 'ComponentPosition',
            '_metadata': { persisted: true },
          },
        },
      })
      expect(tabs).toHaveLength(2)
    })

    test('COMPONENT_POSITION with isDataPage and isDynamicPosition adds DataPage tab', () => {
      mockIsDataPage.value = true
      const resolver = new ManagerTabsResolver()
      const tabs = resolver.resolve({
        resourceType: CwaResourceTypes.COMPONENT_POSITION,
        resource: {
          data: {
            '@id': '/positions/1',
            '@type': 'ComponentPosition',
            '_metadata': { persisted: true, isDynamicPosition: true },
          },
        },
      })
      expect(tabs).toHaveLength(2)
    })

    test('component type adds Ui and Order tabs', () => {
      const resolver = new ManagerTabsResolver()
      const tabs = resolver.resolve({
        resourceType: 'Component',
        resource: makeResource(),
      })
      expect(tabs).toHaveLength(3)
    })

    test('component type adds Publish tab when resource has publishable state', () => {
      const resolver = new ManagerTabsResolver()
      const tabs = resolver.resolve({
        resourceType: 'Component',
        resource: makeResource(true),
      })
      expect(tabs).toHaveLength(4)
    })

    test('component type does not add Publish tab when no publishable state', () => {
      const resolver = new ManagerTabsResolver()
      const tabs = resolver.resolve({
        resourceType: 'Component',
        resource: makeResource(),
      })
      expect(tabs).toHaveLength(3)
    })
  })
})

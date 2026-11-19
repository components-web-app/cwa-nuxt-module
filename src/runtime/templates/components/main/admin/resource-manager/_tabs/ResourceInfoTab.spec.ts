// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import { axe } from '../../../../../../../../test/utils/axe'
import ResourceInfoTab from './ResourceInfoTab.vue'
import { CwaResourceTypes } from '#cwa/resources/resource-utils'

const iri = ref<string>('/component/abc')
const resourceData = ref<Record<string, any>>({})

const mocks = vi.hoisted(() => ({
  vueApp: { name: 'vue-app' },
  confirmChoice: vi.fn(),
  editingNotice: vi.fn(async (): Promise<string | undefined> => undefined),
}))

const usageResponses = new Map<string, Promise<unknown>>()
const storedResources = new Map<string, Record<string, any>>()
const closestStackItems = new Map<string, string>()

const mockCwa = {
  fetch: vi.fn(({ path }: { path: string }) => ({
    response: usageResponses.get(path) ?? Promise.resolve({ _data: { positionCount: 1, pageDataCount: 0, total: 1 } }),
    headers: {},
  })),
  resources: {
    isDataPage: computed(() => false),
    getRefreshEndpointsForDelete: vi.fn(() => ['/_/component_positions/p1']),
    getResource: (id: string) => computed(() => storedResources.has(id) ? { data: storedResources.get(id) } : undefined),
    pageDataIriOf: (id: string) => computed(() => id === '/_/component_positions/dynamic' ? '/page_data/pd1' : undefined),
  },
  resourcesManager: {
    deleteResource: vi.fn(async () => undefined),
    updateResource: vi.fn(async () => undefined),
    queueComponentGroupWrite: vi.fn(async (_groupIri: string, write: () => Promise<unknown>) => write()),
  },
  admin: {
    emptyStack: vi.fn(),
    resourceStackManager: {
      isEditingLayout: computed(() => false),
      getClosestStackItemByType: vi.fn((type: string) => closestStackItems.get(type)),
      isComponentGroupDisabled: () => false,
      currentIri: iri,
    },
  },
}

vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => mockCwa }))

vi.mock('#app/nuxt', async importOriginal => ({
  ...await importOriginal<typeof import('#app/nuxt')>(),
  useNuxtApp: () => ({ vueApp: mocks.vueApp }),
}))

vi.mock('#cwa/admin/resource-confirm', () => ({
  editingNotice: mocks.editingNotice,
  confirmChoice: mocks.confirmChoice,
}))

vi.mock('#cwa/composables/cwa-resource-manager-tab', () => ({
  useCwaResourceManagerTab: () => ({
    iri,
    resource: computed(() => ({ data: resourceData.value })),
    $cwa: mockCwa,
    exposeMeta: { disabled: ref(false) },
  }),
}))

enableAutoUnmount(afterEach)

function mountInfoTab() {
  return mount(ResourceInfoTab, { attachTo: document.body })
}

function usage(total: number) {
  return Promise.resolve({ _data: { positionCount: total, pageDataCount: 0, total } })
}

function inLocations(total: number) {
  usageResponses.set(`${iri.value}/usage`, usage(total))
}

function inStackPosition(positionIri = '/_/component_positions/p1', groupIri = '/_/component_groups/g1') {
  closestStackItems.set(CwaResourceTypes.COMPONENT_POSITION, positionIri)
  closestStackItems.set(CwaResourceTypes.COMPONENT_GROUP, groupIri)
}

function revealChoosing(choice?: 'go' | 'extra' | 'alternative' | 'all' | 'here') {
  mocks.confirmChoice.mockResolvedValue(choice === 'all' ? 'go' : choice === 'here' ? 'extra' : choice)
}

function publishable(published: boolean) {
  return { '@id': iri.value, '_metadata': { publishable: { published } } }
}

describe('Info tab — the delete button', () => {
  beforeEach(() => {
    iri.value = '/component/abc'
    resourceData.value = {}
  })

  test.each([
    ['a draft of a live component', { ...publishable(false), publishedResource: '/component/live' }],
    ['a live component', publishable(true)],
    ['a resource that is not publishable', { '@id': '/component/abc', '_metadata': {} }],
  ])('says Delete for %s, never Delete Draft or Delete Live (#461)', (_label, data) => {
    resourceData.value = data
    const wrapper = mountInfoTab()

    expect(wrapper.find('[data-testid="component-delete"] button').text()).toBe('Delete')
  })

  test('adding a new resource says Discard, even when it is publishable', () => {
    iri.value = NEW_RESOURCE_IRI
    resourceData.value = publishable(false)
    const wrapper = mountInfoTab()

    expect(wrapper.find('[data-testid="component-delete"] button').text()).toBe('Discard')
  })
})

describe('Info tab — a component in several locations', () => {
  beforeEach(() => {
    iri.value = '/component/abc'
    resourceData.value = { '@id': iri.value, '_metadata': { persisted: true } }
    usageResponses.clear()
    storedResources.clear()
    closestStackItems.clear()
  })

  afterEach(() => {
    mocks.confirmChoice.mockReset()
    mocks.editingNotice.mockReset()
  })

  test('shows Used in X locations for a component in more than one location', async () => {
    inLocations(3)
    const wrapper = mountInfoTab()
    await flushPromises()

    expect(mockCwa.fetch).toHaveBeenCalledWith({ path: '/component/abc/usage', noQuery: true })
    expect(wrapper.text()).toContain('Used in 3 locations')
  })

  test('shows no usage text for a component in one location', async () => {
    inLocations(1)
    const wrapper = mountInfoTab()
    await flushPromises()

    expect(mockCwa.fetch).toHaveBeenCalledWith({ path: '/component/abc/usage', noQuery: true })
    expect(wrapper.text()).not.toContain('Used in')
  })

  test('reads the usage again when the selection changes', async () => {
    inLocations(3)
    const wrapper = mountInfoTab()
    await flushPromises()

    iri.value = '/component/other'
    inLocations(4)
    await flushPromises()

    expect(wrapper.text()).toContain('Used in 4 locations')
  })

  test('a usage response for a previous selection is ignored', async () => {
    let resolveFirst: (value: unknown) => void = () => {}
    usageResponses.set('/component/abc/usage', new Promise((resolve) => {
      resolveFirst = resolve
    }))
    const wrapper = mountInfoTab()
    await flushPromises()

    iri.value = '/component/other'
    inLocations(1)
    await flushPromises()
    resolveFirst({ _data: { positionCount: 5, pageDataCount: 0, total: 5 } })
    await flushPromises()

    expect(wrapper.text()).not.toContain('Used in')
  })

  test.each([
    ['a component not yet persisted', '/component/abc', { _metadata: { persisted: false } }],
    ['a component group', '/_/component_groups/g1', { _metadata: { persisted: true } }],
    ['a new resource being added', NEW_RESOURCE_IRI, { _metadata: { persisted: true } }],
  ])('does not read the usage of %s', async (_label, selectedIri, data) => {
    iri.value = selectedIri
    resourceData.value = { '@id': selectedIri, ...data }
    mountInfoTab()
    await flushPromises()

    expect(mockCwa.fetch).not.toHaveBeenCalled()
  })

  test('Delete for a component in several locations asks which to delete, saying what each action does and that deleting can\'t be undone', async () => {
    inLocations(3)
    inStackPosition()
    revealChoosing()
    const wrapper = mountInfoTab()
    await flushPromises()

    await wrapper.find('[data-testid="component-delete"] button').trigger('click')
    await flushPromises()

    expect(mocks.confirmChoice).toHaveBeenCalledWith(mocks.vueApp, {
      title: 'Delete this component?',
      description: 'It is used in 3 places.',
      keep: 'Cancel',
      extra: 'Remove from here',
      go: 'Delete from all 3 places',
      lines: [
        { text: 'Remove from here takes it off this location only. It stays in the other 2 places.' },
        { text: 'Delete from all 3 places deletes it everywhere it is used.' },
        { text: 'Deleting can\'t be undone.', emphasis: 'strong' },
      ],
    })
    expect(mockCwa.resourcesManager.deleteResource).not.toHaveBeenCalled()
    expect(mockCwa.admin.emptyStack).not.toHaveBeenCalled()
  })

  test('the question says who else is editing the component (#429)', async () => {
    inLocations(3)
    inStackPosition()
    revealChoosing()
    mocks.editingNotice.mockResolvedValue('Sam is editing this.')
    const wrapper = mountInfoTab()
    await flushPromises()

    await wrapper.find('[data-testid="component-delete"] button').trigger('click')
    await flushPromises()

    expect(mocks.editingNotice).toHaveBeenCalledWith(mockCwa, '/component/abc')
    expect(mocks.confirmChoice).toHaveBeenCalledWith(mocks.vueApp, expect.objectContaining({ lines: [
      { text: 'Sam is editing this.' },
      { text: 'Remove from here takes it off this location only. It stays in the other 2 places.' },
      { text: 'Delete from all 3 places deletes it everywhere it is used.' },
      { text: 'Deleting can\'t be undone.', emphasis: 'strong' },
    ] }))
  })

  test('Delete from all X locations deletes the component without a second confirmation', async () => {
    inLocations(3)
    inStackPosition()
    revealChoosing('all')
    const wrapper = mountInfoTab()
    await flushPromises()

    await wrapper.find('[data-testid="component-delete"] button').trigger('click')
    await flushPromises()

    expect(mockCwa.resourcesManager.deleteResource).toHaveBeenCalledTimes(1)
    expect(mockCwa.resourcesManager.deleteResource).toHaveBeenCalledWith({
      endpoint: '/component/abc',
      refreshEndpoints: ['/_/component_positions/p1'],
    }, true)
    expect(mockCwa.admin.emptyStack).toHaveBeenCalled()
  })

  test('Remove from here deletes only the closest position', async () => {
    inLocations(3)
    inStackPosition('/_/component_positions/p2', '/_/component_groups/g2')
    revealChoosing('here')
    const wrapper = mountInfoTab()
    await flushPromises()

    await wrapper.find('[data-testid="component-delete"] button').trigger('click')
    await flushPromises()

    expect(mockCwa.resourcesManager.deleteResource).toHaveBeenCalledTimes(1)
    expect(mockCwa.resourcesManager.deleteResource).toHaveBeenCalledWith({
      endpoint: '/_/component_positions/p2',
      refreshEndpoints: ['/_/component_groups/g2'],
    }, true)
    expect(mockCwa.resourcesManager.updateResource).not.toHaveBeenCalled()
    expect(mockCwa.admin.emptyStack).toHaveBeenCalled()
  })

  test('Remove from here deletes the position through its group\'s write queue, so it cannot race an insert or reorder there (#415)', async () => {
    inLocations(3)
    inStackPosition('/_/component_positions/p2', '/_/component_groups/g2')
    revealChoosing('here')
    let deletedInQueue = false
    mockCwa.resourcesManager.queueComponentGroupWrite.mockImplementationOnce(async (_groupIri, write) => {
      const result = await write()
      deletedInQueue = mockCwa.resourcesManager.deleteResource.mock.calls.length === 1
      return result
    })
    const wrapper = mountInfoTab()
    await flushPromises()

    await wrapper.find('[data-testid="component-delete"] button').trigger('click')
    await flushPromises()

    expect(mockCwa.resourcesManager.queueComponentGroupWrite).toHaveBeenCalledTimes(1)
    expect(mockCwa.resourcesManager.queueComponentGroupWrite).toHaveBeenCalledWith('/_/component_groups/g2', expect.any(Function))
    expect(deletedInQueue).toBe(true)
  })

  test('Remove from here with no group in the stack deletes the position directly', async () => {
    inLocations(3)
    inStackPosition('/_/component_positions/p2')
    closestStackItems.delete(CwaResourceTypes.COMPONENT_GROUP)
    revealChoosing('here')
    const wrapper = mountInfoTab()
    await flushPromises()

    await wrapper.find('[data-testid="component-delete"] button').trigger('click')
    await flushPromises()

    expect(mockCwa.resourcesManager.deleteResource).toHaveBeenCalledWith({ endpoint: '/_/component_positions/p2', refreshEndpoints: [] }, true)
    expect(mockCwa.resourcesManager.queueComponentGroupWrite).not.toHaveBeenCalled()
  })

  test('Remove from here empties a page-data slot instead of deleting its position', async () => {
    inLocations(3)
    inStackPosition('/_/component_positions/dynamic', '/_/component_groups/g2')
    storedResources.set('/_/component_positions/dynamic', { pageDataProperty: 'heroComponent' })
    revealChoosing('here')
    const wrapper = mountInfoTab()
    await flushPromises()

    await wrapper.find('[data-testid="component-delete"] button').trigger('click')
    await flushPromises()

    expect(mockCwa.resourcesManager.updateResource).toHaveBeenCalledWith({
      endpoint: '/page_data/pd1',
      data: { heroComponent: null },
      refreshEndpoints: ['/_/component_positions/dynamic'],
    })
    expect(mockCwa.resourcesManager.deleteResource).not.toHaveBeenCalled()
    expect(mockCwa.resourcesManager.queueComponentGroupWrite).not.toHaveBeenCalled()
    expect(mockCwa.admin.emptyStack).toHaveBeenCalled()
  })

  test('the stack is kept when the delete fails', async () => {
    inLocations(3)
    inStackPosition()
    revealChoosing('here')
    mockCwa.resourcesManager.deleteResource.mockResolvedValueOnce(false as any)
    const wrapper = mountInfoTab()
    await flushPromises()

    await wrapper.find('[data-testid="component-delete"] button').trigger('click')
    await flushPromises()

    expect(mockCwa.resourcesManager.deleteResource).toHaveBeenCalled()
    expect(mockCwa.admin.emptyStack).not.toHaveBeenCalled()
  })

  async function expectTodaysDelete() {
    const wrapper = mountInfoTab()
    await flushPromises()

    await wrapper.find('[data-testid="component-delete"] button').trigger('click')
    await flushPromises()

    expect(mocks.confirmChoice).not.toHaveBeenCalled()
    expect(mockCwa.resourcesManager.deleteResource).toHaveBeenCalledWith({
      endpoint: '/component/abc',
      refreshEndpoints: ['/_/component_positions/p1'],
    })
    expect(mockCwa.admin.emptyStack).toHaveBeenCalled()
  }

  test('Delete for a component in one location behaves as today', async () => {
    inLocations(1)
    inStackPosition()
    await expectTodaysDelete()
  })

  test('Delete falls back to today\'s confirmation when the usage request fails', async () => {
    usageResponses.set('/component/abc/usage', Promise.reject(new Error('Server Error')))
    inStackPosition()
    await expectTodaysDelete()
  })

  test('Delete falls back to today\'s confirmation when no position is in the stack', async () => {
    inLocations(3)
    await expectTodaysDelete()
  })

  test('Delete for a component not yet persisted does not read its usage', async () => {
    resourceData.value = { '@id': iri.value, '_metadata': { persisted: false } }
    inLocations(3)
    inStackPosition()
    await expectTodaysDelete()

    expect(mockCwa.fetch).not.toHaveBeenCalled()
  })

  describe('a draft of a live component (#461)', () => {
    const LIVE = '/component/live'
    const positionDelete = { endpoint: '/_/component_positions/p1', refreshEndpoints: ['/_/component_groups/g1'] }

    beforeEach(() => {
      resourceData.value = { ...publishable(false), _metadata: { persisted: true, publishable: { published: false } }, publishedResource: LIVE }
    })

    async function clickDelete() {
      const wrapper = mountInfoTab()
      await flushPromises()
      await wrapper.find('[data-testid="component-delete"] button').trigger('click')
      await flushPromises()
    }

    test('in one place, asks once with Delete draft beside Delete entire component, saying what each destroys and that neither can be undone', async () => {
      inLocations(1)
      inStackPosition()
      revealChoosing()

      await clickDelete()

      expect(mocks.confirmChoice).toHaveBeenCalledTimes(1)
      expect(mocks.confirmChoice).toHaveBeenCalledWith(mocks.vueApp, {
        title: 'Delete this component?',
        description: 'It has unpublished changes.',
        keep: 'Cancel',
        extra: 'Delete draft',
        extraTone: 'danger',
        go: 'Delete entire component',
        lines: [
          { text: 'Delete draft discards the unpublished changes. The live version stays.' },
          { text: 'Delete entire component deletes the draft and the live version.' },
          { text: 'Neither can be undone.', emphasis: 'strong' },
        ],
      })
      expect(mockCwa.resourcesManager.deleteResource).not.toHaveBeenCalled()
    })

    test('Delete draft deletes only the draft', async () => {
      inLocations(1)
      inStackPosition()
      revealChoosing('extra')

      await clickDelete()

      expect(mockCwa.resourcesManager.deleteResource.mock.calls).toEqual([[{ endpoint: '/component/abc', refreshEndpoints: ['/_/component_positions/p1'] }, true]])
      expect(mockCwa.admin.emptyStack).toHaveBeenCalled()
    })

    test('Delete entire component removes the draft and then the live component, so no position is left on either', async () => {
      inLocations(1)
      inStackPosition()
      revealChoosing('go')

      await clickDelete()

      expect(mockCwa.resourcesManager.deleteResource.mock.calls).toEqual([
        [{ endpoint: '/component/abc', refreshEndpoints: [] }, true],
        [{ endpoint: LIVE, refreshEndpoints: ['/_/component_positions/p1'] }, true],
      ])
      expect(mockCwa.admin.emptyStack).toHaveBeenCalled()
    })

    test('Delete stops, keeping the live component and the stack, when the draft is still there after its delete', async () => {
      inLocations(1)
      inStackPosition()
      revealChoosing('go')
      storedResources.set('/component/abc', resourceData.value)

      await clickDelete()

      expect(mockCwa.resourcesManager.deleteResource).toHaveBeenCalledTimes(1)
      expect(mockCwa.admin.emptyStack).not.toHaveBeenCalled()
    })

    test('in several places, asks once with Remove from here, Delete draft and Delete entire component, which says it goes from all N places', async () => {
      inLocations(3)
      inStackPosition()
      revealChoosing()

      await clickDelete()

      expect(mocks.confirmChoice).toHaveBeenCalledWith(mocks.vueApp, {
        title: 'Delete this component?',
        description: 'It is used in 3 places and has unpublished changes.',
        keep: 'Cancel',
        extra: 'Remove from here',
        alternative: 'Delete draft',
        alternativeTone: 'danger',
        go: 'Delete entire component',
        lines: [
          { text: 'Remove from here takes it off this location only. It stays in the other 2 places.' },
          { text: 'Delete draft discards the unpublished changes. The live version stays.' },
          { text: 'Delete entire component deletes the draft and the live version from all 3 places it is used.' },
          { text: 'Neither delete can be undone.', emphasis: 'strong' },
        ],
      })
    })

    test('in several places, Remove from here deletes only this position', async () => {
      inLocations(3)
      inStackPosition()
      revealChoosing('extra')

      await clickDelete()

      expect(mockCwa.resourcesManager.deleteResource.mock.calls).toEqual([[positionDelete, true]])
      expect(mockCwa.resourcesManager.queueComponentGroupWrite).toHaveBeenCalledWith('/_/component_groups/g1', expect.any(Function))
    })

    test('in several places, Delete draft deletes only the draft', async () => {
      inLocations(3)
      inStackPosition()
      revealChoosing('alternative')

      await clickDelete()

      expect(mockCwa.resourcesManager.deleteResource.mock.calls).toEqual([[{ endpoint: '/component/abc', refreshEndpoints: ['/_/component_positions/p1'] }, true]])
    })

    test('in several places, Delete entire component removes the draft and then the live component', async () => {
      inLocations(3)
      inStackPosition()
      revealChoosing('go')

      await clickDelete()

      expect(mockCwa.resourcesManager.deleteResource.mock.calls).toEqual([
        [{ endpoint: '/component/abc', refreshEndpoints: [] }, true],
        [{ endpoint: LIVE, refreshEndpoints: ['/_/component_positions/p1'] }, true],
      ])
    })

    test('with no position in the stack, offers no Remove from here', async () => {
      inLocations(3)
      revealChoosing()

      await clickDelete()

      expect(mocks.confirmChoice).toHaveBeenCalledWith(mocks.vueApp, expect.objectContaining({ extra: 'Delete draft', extraTone: 'danger', go: 'Delete entire component' }))
      expect(mocks.confirmChoice.mock.calls[0]![1]).not.toHaveProperty('alternative')
    })

    test('Cancel sends nothing and keeps the stack', async () => {
      inLocations(3)
      inStackPosition()
      revealChoosing()

      await clickDelete()

      expect(mockCwa.resourcesManager.deleteResource).not.toHaveBeenCalled()
      expect(mockCwa.admin.emptyStack).not.toHaveBeenCalled()
    })
  })

  describe('a draft that has never been published', () => {
    beforeEach(() => {
      resourceData.value = { ...publishable(false), _metadata: { persisted: true, publishable: { published: false } } }
    })

    async function clickDelete() {
      const wrapper = mountInfoTab()
      await flushPromises()
      await wrapper.find('[data-testid="component-delete"] button').trigger('click')
      await flushPromises()
    }

    test('in one place, asks with Delete draft alone, saying it deletes the component as there is no live version', async () => {
      inLocations(1)
      inStackPosition()
      revealChoosing()

      await clickDelete()

      expect(mocks.confirmChoice).toHaveBeenCalledWith(mocks.vueApp, {
        title: 'Delete this component?',
        description: 'It has never been published.',
        keep: 'Cancel',
        go: 'Delete draft',
        lines: [
          { text: 'Delete draft deletes the component, as there is no live version to keep.' },
          { text: 'This can\'t be undone.', emphasis: 'strong' },
        ],
      })
    })

    test('in several places, offers Remove from here beside Delete draft, which says it goes from all N places', async () => {
      inLocations(3)
      inStackPosition()
      revealChoosing()

      await clickDelete()

      expect(mocks.confirmChoice).toHaveBeenCalledWith(mocks.vueApp, {
        title: 'Delete this component?',
        description: 'It is used in 3 places and has never been published.',
        keep: 'Cancel',
        extra: 'Remove from here',
        go: 'Delete draft',
        lines: [
          { text: 'Remove from here takes it off this location only. It stays in the other 2 places.' },
          { text: 'Delete draft deletes it from all 3 places, as there is no live version to keep.' },
          { text: 'Deleting can\'t be undone.', emphasis: 'strong' },
        ],
      })
    })

    test('in two places, names the one other place', async () => {
      inLocations(2)
      inStackPosition()
      revealChoosing()

      await clickDelete()

      expect(mocks.confirmChoice.mock.calls[0]![1].lines[0]).toEqual({ text: 'Remove from here takes it off this location only. It stays in the other place.' })
    })

    test('Delete draft deletes the component once, without a second confirmation', async () => {
      inLocations(1)
      inStackPosition()
      revealChoosing('go')

      await clickDelete()

      expect(mockCwa.resourcesManager.deleteResource.mock.calls).toEqual([[{ endpoint: '/component/abc', refreshEndpoints: ['/_/component_positions/p1'] }, true]])
      expect(mockCwa.admin.emptyStack).toHaveBeenCalled()
    })
  })

  test('is one manager-tab row: the ID read-only, the usage, then the delete action after a divider, with no axe violations (#460)', async () => {
    usageResponses.set('/component/abc/usage', usage(3))
    const wrapper = mountInfoTab()
    await flushPromises()

    expect(wrapper.find('[data-testid="manager-tab"]').exists()).toBe(true)
    const id = wrapper.get('[data-testid="resource-id"] input')
    expect(id.attributes('readonly')).toBeDefined()
    expect((id.element as HTMLInputElement).value).toBe('/component/abc')
    expect(wrapper.get('[data-testid="resource-usage"]').text()).toBe('Used in 3 locations')
    const row = wrapper.get('[data-testid="manager-tab"]').html()
    expect(row.indexOf('cwa:bg-line')).toBeGreaterThan(row.indexOf('resource-usage'))
    expect(row.indexOf('cwa:bg-line')).toBeLessThan(row.indexOf('component-delete'))
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test('the ID has Copy ID beside it, which copies the component\'s IRI for a bug report (#461)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const wrapper = mountInfoTab()
    await flushPromises()

    const copy = wrapper.get('[data-testid="resource-id-copy"]')
    expect(copy.attributes('aria-label')).toBe('Copy ID')
    expect(copy.element.compareDocumentPosition(wrapper.get('[data-testid="resource-id"]').element) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    await copy.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('/component/abc')
    vi.unstubAllGlobals()
  })

  test('a component not added yet has no ID to copy (#461)', async () => {
    iri.value = NEW_RESOURCE_IRI
    const wrapper = mountInfoTab()
    await flushPromises()

    expect(wrapper.find('[data-testid="resource-id-copy"]').exists()).toBe(false)
  })
})

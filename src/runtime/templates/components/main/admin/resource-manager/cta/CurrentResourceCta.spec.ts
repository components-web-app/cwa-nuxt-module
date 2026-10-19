// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CurrentResourceCta from './CurrentResourceCta.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { useCloneMode } from '#cwa/admin/clone-mode'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'

const ButtonStub = {
  name: 'CwaUiFormButton',
  props: ['disabled', 'options'],
  emits: ['click'],
  template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
}

function mountCta() {
  const updateResource = vi.fn().mockResolvedValue(undefined)
  const $cwa = {
    resourcesManager: { updateResource },
    resources: { getResource: vi.fn(() => ({ value: undefined })) },
    admin: { resourceStackManager: { resourceStack: { value: [] } } },
  }
  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue($cwa as any)
  const wrapper = mount(CurrentResourceCta, {
    props: {
      currentIri: '/component/draft',
      resource: {
        '@id': '/component/draft',
        '@type': 'HtmlContent',
        '_metadata': { persisted: true, publishable: { published: false } },
      } as any,
    },
    global: { stubs: { CwaUiFormButton: ButtonStub } },
  })
  return { wrapper, updateResource }
}

const cloneModeCwas: any[] = []

describe('CurrentResourceCta', () => {
  afterEach(() => {
    cloneModeCwas.splice(0).forEach($cwa => useCloneMode($cwa).end())
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  test('Publish publishes the draft by the API\'s clock, sending "now" (#381)', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-25T12:00:00Z'), toFake: ['Date'] })
    const { wrapper, updateResource } = mountCta()

    expect(wrapper.text()).toBe('Publish')
    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(updateResource).toHaveBeenCalledTimes(1)
    expect(updateResource).toHaveBeenCalledWith({
      endpoint: '/component/draft',
      data: { publishedAt: 'now' },
    })
  })

  describe('adding into a group with a maximum (#398)', () => {
    const groupIri = '/_/component_groups/g1'

    function mountFor(currentIri: string, group: Record<string, any>) {
      const groups: Record<string, any> = { [groupIri]: { data: { '@id': groupIri, ...group } } }
      const $cwa = {
        resourcesManager: { updateResource: vi.fn(), initAddResource: vi.fn() },
        resources: { getResource: vi.fn((iri: string) => ({ value: groups[iri] })) },
        admin: { resourceStackManager: { resourceStack: { value: [{ iri: '/component/c1' }, { iri: '/_/component_positions/p1' }, { iri: groupIri }, { iri: '/_/layouts/l1' }] } } },
      }
      vi.spyOn(cwaComposable, 'useCwa').mockReturnValue($cwa as any)
      const wrapper = mount(CurrentResourceCta, {
        props: {
          currentIri,
          resource: { '@id': currentIri, '_metadata': { persisted: true } } as any,
        },
        global: { stubs: { CwaUiFormButton: ButtonStub } },
      })
      const labels = (wrapper.findComponent(ButtonStub).props('options') as any[]).flat().map(option => option.label)
      return { labels }
    }

    test('offers Clone and Move when the component\'s own group is full, without the add options (#157, #398, #409)', () => {
      const { labels } = mountFor('/component/c1', { maxComponents: 1, componentPositions: ['/_/component_positions/p1'] })

      expect(labels).toEqual(['Clone', 'Move'])
    })

    test.each([
      [groupIri, ['Add to Start', 'Add to End']],
      ['/component/c1', ['Add Before', 'Add After', 'Clone', 'Move']],
      ['/_/component_positions/p1', ['Add Before', 'Add After']],
    ])('offers adding for %s while its group has room', (currentIri, expected) => {
      const { labels } = mountFor(currentIri, { maxComponents: 2, componentPositions: ['/_/component_positions/p1'] })

      expect(labels).toEqual(expected)
    })

    test.each([
      groupIri,
      '/component/c1',
      '/_/component_positions/p1',
    ])('does not offer adding for %s when its group is full', (currentIri) => {
      const { labels } = mountFor(currentIri, { maxComponents: 1, componentPositions: ['/_/component_positions/p1'] })

      expect(labels.filter(label => label.startsWith('Add'))).toEqual([])
    })
  })

  describe('clone (#157)', () => {
    function mountClone(currentIri: string, metadata: Record<string, any> = { persisted: true }, ops: { stack?: string[], byId?: Record<string, any>, isEditingLayout?: boolean } = {}) {
      const emptyStack = vi.fn()
      const $cwa = {
        resourcesManager: { updateResource: vi.fn(), initAddResource: vi.fn() },
        resources: { getResource: vi.fn((iri: string) => ({ value: ops.byId?.[iri] ? { data: ops.byId[iri] } : undefined })), displayPageIri: { value: undefined } },
        auth: { user: { '@id': '/_/users/1' } },
        admin: {
          isEditing: true,
          emptyStack,
          setNavigationGuardDisabled: vi.fn(),
          resourceStackManager: {
            resourceStack: { value: (ops.stack ?? [currentIri]).map(iri => ({ iri })) },
            currentStackItem: { value: { iri: currentIri, displayName: 'Hero Section' } },
            isEditingLayout: { value: ops.isEditingLayout ?? false },
          },
        },
      }
      cloneModeCwas.push($cwa)
      vi.spyOn(cwaComposable, 'useCwa').mockReturnValue($cwa as any)
      const wrapper = mount(CurrentResourceCta, {
        props: {
          currentIri,
          resource: { '@id': currentIri, '@type': 'HtmlContent', '_metadata': metadata } as any,
        },
        global: { stubs: { CwaUiFormButton: ButtonStub } },
      })
      const button = wrapper.findComponent(ButtonStub)
      const options = (button.props('options') as any[]).flat()
      return { $cwa, button, options, labels: options.map(option => option.label), emptyStack }
    }

    test('offers Clone for a persisted component', () => {
      const { options } = mountClone('/component/c1')

      expect(options).toContainEqual({ label: 'Clone', value: 'clone', testId: 'component-menu-clone' })
    })

    test.each([
      ['/component/c1', { persisted: false, adding: { instantAdd: false, endpoint: '/component/html_contents', isPublishable: true } }],
      [NEW_RESOURCE_IRI, { persisted: false, adding: { instantAdd: false, endpoint: '/component/html_contents', isPublishable: true } }],
    ])('does not offer Clone for a component being added (%s)', (currentIri, metadata) => {
      const { labels } = mountClone(currentIri, metadata)

      expect(labels).not.toContain('Clone')
    })

    test.each([
      '/_/component_positions/p1',
      '/_/component_groups/g1',
    ])('does not offer Clone for a position or a group (%s)', (currentIri) => {
      const { labels } = mountClone(currentIri)

      expect(labels).not.toContain('Clone')
    })

    test('choosing Clone starts clone mode with the component IRI and name and empties the stack', async () => {
      const { $cwa, button, emptyStack } = mountClone('/component/c1')

      button.vm.$emit('click', 'clone')
      await flushPromises()

      expect(useCloneMode($cwa as any).source.value).toEqual({ iri: '/component/c1', name: 'Hero Section' })
      expect(emptyStack).toHaveBeenCalledTimes(1)
      expect($cwa.resourcesManager.initAddResource).not.toHaveBeenCalled()
    })

    describe('move (#409)', () => {
      const POSITION = '/_/component_positions/p1'
      const GROUP = '/_/component_groups/g1'
      const stack = ['/component/c1', POSITION, GROUP]

      test('offers Move for a persisted component in a position', () => {
        const { options } = mountClone('/component/c1', { persisted: true }, { stack, byId: { [POSITION]: { componentGroup: GROUP } } })

        expect(options).toContainEqual({ label: 'Move', value: 'move', testId: 'component-menu-move' })
      })

      test.each([
        ['with no position in the stack', { stack: ['/component/c1'] }],
        ['in a page-data slot, which every page-data page shares', { stack, byId: { [POSITION]: { pageDataProperty: 'hero' } } }],
        ['in a dynamic position, as a visitor sees it', { stack, byId: { [POSITION]: { _metadata: { isDynamicPosition: true } } } }],
      ])('does not offer Move %s', (_label, ops) => {
        const { labels } = mountClone('/component/c1', { persisted: true }, ops)

        expect(labels).not.toContain('Move')
      })

      test('does not offer Move for a component being added', () => {
        const { labels } = mountClone('/component/c1', { persisted: false, adding: { instantAdd: false, endpoint: '/component/html_contents', isPublishable: true } }, { stack })

        expect(labels).not.toContain('Move')
      })

      test.each([false, true])('choosing Move starts move mode with the selected position and whether it is in the layout (%s), and empties the stack', async (isEditingLayout) => {
        const { $cwa, button, emptyStack } = mountClone('/component/c1', { persisted: true }, { stack, isEditingLayout, byId: { [POSITION]: { componentGroup: GROUP } } })

        button.vm.$emit('click', 'move')
        await flushPromises()

        expect(useCloneMode($cwa as any).source.value).toEqual({ iri: '/component/c1', name: 'Hero Section', move: { positionIri: POSITION, fromLayout: isEditingLayout } })
        expect(emptyStack).toHaveBeenCalledTimes(1)
      })
    })
  })
})

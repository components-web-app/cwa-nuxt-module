// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import CurrentResourceCta from './CurrentResourceCta.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { useCloneMode } from '#cwa/admin/clone-mode'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'

const ButtonStub = {
  name: 'CwaUiButton',
  props: ['label', 'shortLabel', 'disabled', 'disabledReason', 'options', 'loading', 'largeIcon'],
  emits: ['click', 'select'],
  template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
}

const stubs = { Button: ButtonStub }

function flatten(entries: any[]) {
  return entries.flatMap(entry => 'items' in entry ? entry.items : [entry])
}

function stackState() {
  const state = reactive<Record<string, any>>({})
  return {
    getState: vi.fn((key: string) => state[key]),
    setState: vi.fn((key: string, value: any) => {
      state[key] = value
    }),
  }
}

function mountCta() {
  const updateResource = vi.fn().mockResolvedValue(undefined)
  const $cwa = {
    resourcesManager: { updateResource },
    resources: { getResource: vi.fn(() => ({ value: undefined })) },
    admin: { resourceStackManager: { resourceStack: { value: [] }, ...stackState() } },
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
    global: { stubs },
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

  test('a draft that is not being scheduled offers Publish now as the main action (#459)', () => {
    const { wrapper } = mountCta()

    expect(wrapper.findComponent(ButtonStub).props('label')).toBe('Publish now')
    expect(wrapper.findComponent(ButtonStub).props('disabled')).toBe(false)
  })

  test('below sm Publish now reads Publish, so the tab strip keeps its room on a phone (#460)', () => {
    const { wrapper } = mountCta()

    expect(wrapper.findComponent(ButtonStub).props('shortLabel')).toBe('Publish')
  })

  test('the bar CTA\'s ⋮ asks for the large icon', () => {
    const { wrapper } = mountCta()
    expect(wrapper.findComponent(ButtonStub).props('largeIcon')).toBe(true)
  })

  test('Publish publishes the draft by the API\'s clock, sending "now" (#381)', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-25T12:00:00Z'), toFake: ['Date'] })
    const { wrapper, updateResource } = mountCta()

    expect(wrapper.text()).toBe('Publish now')
    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(updateResource).toHaveBeenCalledTimes(1)
    expect(updateResource).toHaveBeenCalledWith({
      endpoint: '/component/draft',
      data: { publishedAt: 'now' },
      retry: expect.any(Function),
    })
  })

  describe('publishing a draft from the pinned action (#459)', () => {
    const NOW = new Date('2026-09-25T12:00:00Z')

    function mountDraft(publishedAt?: string) {
      let finish: (saved?: unknown) => void = () => {}
      const updateResource = vi.fn(() => new Promise((resolve) => {
        finish = resolve
      }))
      const stack = { resourceStack: { value: [] }, ...stackState() }
      const $cwa = {
        resourcesManager: { updateResource },
        resources: { getResource: vi.fn(() => ({ value: undefined })) },
        admin: { resourceStackManager: stack },
      }
      vi.spyOn(cwaComposable, 'useCwa').mockReturnValue($cwa as any)
      const wrapper = mount(CurrentResourceCta, {
        props: {
          currentIri: '/component/draft',
          resource: { '@id': '/component/draft', '@type': 'HtmlContent', publishedAt, '_metadata': { persisted: true, publishable: { published: false } } } as any,
        },
        global: { stubs },
      })
      const button = () => wrapper.findComponent(ButtonStub)
      const labels = () => flatten(button().props('options') as any[]).map(option => option.label)
      return { wrapper, button, labels, stack, updateResource, finish: (saved?: unknown) => finish(saved) }
    }

    test('offers Cancel schedule only for a draft that is scheduled, not for one with scheduling on and no date yet', async () => {
      vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
      expect(mountDraft('2026-10-01T08:00:00Z').labels()).toContain('Cancel schedule')

      const unscheduled = mountDraft()
      unscheduled.stack.setState('publishScheduling', true)
      await nextTick()
      expect(unscheduled.button().props('label')).toBe('Schedule')
      expect(unscheduled.labels()).not.toContain('Cancel schedule')
    })

    test('choosing Cancel schedule clears the draft\'s publication date', async () => {
      vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
      const { button, updateResource } = mountDraft('2026-10-01T08:00:00Z')

      button().vm.$emit('select', { label: 'Cancel schedule', value: 'cancel-schedule' })
      await flushPromises()

      expect(updateResource).toHaveBeenCalledTimes(1)
      expect(updateResource).toHaveBeenCalledWith({ endpoint: '/component/draft', data: { publishedAt: null }, retry: expect.any(Function) })
    })

    test('with scheduling on the main action reads Schedule and is disabled until a date is chosen, saying why', async () => {
      vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
      const { wrapper, button, stack, updateResource } = mountDraft()
      stack.setState('publishScheduling', true)
      await nextTick()

      expect(button().props('label')).toBe('Schedule')
      expect(button().props('disabled')).toBe(true)
      expect(button().props('disabledReason')).toBe('Choose a date first')

      stack.setState('publishScheduleValue', '2026-10-01T08:00:00.000Z')
      await nextTick()
      expect(button().props('disabled')).toBe(false)
      await wrapper.find('button').trigger('click')
      expect(updateResource).toHaveBeenCalledWith({ endpoint: '/component/draft', data: { publishedAt: '2026-10-01T08:00:00.000Z' }, retry: expect.any(Function) })
    })

    test('shows loading while publishing, and a second press does not publish twice', async () => {
      const { wrapper, button, updateResource, finish } = mountDraft()

      await wrapper.find('button').trigger('click')
      await nextTick()
      expect(button().props('loading')).toBe(true)
      await wrapper.find('button').trigger('click')
      expect(updateResource).toHaveBeenCalledTimes(1)

      finish({ '@id': '/component/draft' })
      await flushPromises()
      expect(button().props('loading')).toBe(false)
    })
  })

  describe('adding into a group with a maximum (#398)', () => {
    const groupIri = '/_/component_groups/g1'

    function mountFor(currentIri: string, group: Record<string, any>) {
      const groups: Record<string, any> = { [groupIri]: { data: { '@id': groupIri, ...group } } }
      const $cwa = {
        resourcesManager: { updateResource: vi.fn(), initAddResource: vi.fn() },
        resources: { getResource: vi.fn((iri: string) => ({ value: groups[iri] })) },
        admin: { resourceStackManager: { resourceStack: { value: [{ iri: '/component/c1' }, { iri: '/_/component_positions/p1' }, { iri: groupIri }, { iri: '/_/layouts/l1' }] }, ...stackState() } },
      }
      vi.spyOn(cwaComposable, 'useCwa').mockReturnValue($cwa as any)
      const wrapper = mount(CurrentResourceCta, {
        props: {
          currentIri,
          resource: { '@id': currentIri, '_metadata': { persisted: true } } as any,
        },
        global: { stubs },
      })
      const options = flatten(wrapper.findComponent(ButtonStub).props('options') as any[])
      return { labels: options.filter(option => !option.disabled).map(option => option.label), disabled: options.filter(option => option.disabled) }
    }

    test('offers Clone and Move when the component\'s own group is full, with one disabled add row that says why (#157, #398, #409, #459)', () => {
      const { labels, disabled } = mountFor('/component/c1', { maxComponents: 1, componentPositions: ['/_/component_positions/p1'], reference: 'Main content' })

      expect(labels).toEqual(['Clone', 'Move'])
      expect(disabled).toEqual([expect.objectContaining({ label: 'Add before or after', disabledReason: 'Main content is full: 1 of 1 components.' })])
    })

    test.each([
      [groupIri, ['Add to start', 'Add to end']],
      ['/component/c1', ['Add before', 'Add after', 'Clone', 'Move']],
      ['/_/component_positions/p1', ['Add before', 'Add after']],
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
    function textElement(text: string) {
      const element = document.createElement('div')
      element.textContent = text
      return element
    }

    function mountClone(currentIri: string, metadata: Record<string, any> = { persisted: true }, ops: { stack?: string[], byId?: Record<string, any>, isEditingLayout?: boolean, pageDataOf?: Record<string, string>, publishable?: string[][] } = {}) {
      const emptyStack = vi.fn()
      const $cwa = {
        resourcesManager: { updateResource: vi.fn(), initAddResource: vi.fn() },
        resources: {
          getResource: vi.fn((iri: string) => ({ value: ops.byId?.[iri] ? { data: ops.byId[iri] } : undefined })),
          pageDataIriOf: vi.fn((iri: string) => ({ value: ops.pageDataOf?.[iri] })),
          findAllPublishableIris: vi.fn((iri: string) => ops.publishable?.find(set => set.includes(iri)) ?? [iri]),
          displayPageIri: { value: undefined },
        },
        auth: { user: { '@id': '/_/users/1' } },
        admin: {
          isEditing: true,
          emptyStack,
          resourceStackManager: {
            resourceStack: { value: (ops.stack ?? [currentIri]).map(iri => ({ iri })) },
            currentStackItem: { value: { iri: currentIri, displayName: 'Hero Section', domElements: { value: [textElement('  Shared source\n component ')] } } },
            isEditingLayout: { value: ops.isEditingLayout ?? false },
            ...stackState(),
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
        global: { stubs },
      })
      const button = wrapper.findComponent(ButtonStub)
      const options = button.exists() ? flatten(button.props('options') as any[]) : []
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

      button.vm.$emit('select', { label: 'Clone', value: 'clone' })
      await flushPromises()

      expect(useCloneMode($cwa as any).source.value).toEqual({ iri: '/component/c1', name: 'Hero Section', excerpt: 'Shared source component' })
      expect(emptyStack).toHaveBeenCalledTimes(1)
      expect($cwa.resourcesManager.initAddResource).not.toHaveBeenCalled()
    })

    test('choosing Clone holds the position it was started from, also a page-data slot\'s, so that instance is outlined apart from the others', async () => {
      const { $cwa, button } = mountClone('/component/c1', { persisted: true }, { stack: ['/component/c1', '/_/component_positions/p1', '/_/component_groups/g1'], byId: { '/_/component_positions/p1': { pageDataProperty: 'hero' } } })

      button.vm.$emit('select', { label: 'Clone', value: 'clone' })
      await flushPromises()

      expect(useCloneMode($cwa as any).source.value).toEqual({ iri: '/component/c1', name: 'Hero Section', excerpt: 'Shared source component', positionIri: '/_/component_positions/p1' })
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
        ['in a dynamic position, as a visitor sees it', { stack, byId: { [POSITION]: { _metadata: { isDynamicPosition: true } } } }],
      ])('does not offer Move %s', (_label, ops) => {
        const { labels } = mountClone('/component/c1', { persisted: true }, ops)

        expect(labels).not.toContain('Move')
      })

      describe('from a page-data slot (#415)', () => {
        const PAGE_DATA = '/page_data/article-1'
        const DRAFT = '/component/c1-draft'
        const slot = { [POSITION]: { pageDataProperty: 'hero', componentGroup: GROUP, _metadata: { isDynamicPosition: true } } }

        test('offers Move when the page data on screen holds the component', () => {
          const { labels } = mountClone('/component/c1', { persisted: true }, { stack, pageDataOf: { [POSITION]: PAGE_DATA }, byId: { ...slot, [PAGE_DATA]: { hero: '/component/c1' } } })

          expect(labels).toContain('Move')
        })

        test('offers Move for the draft of the component the page data holds, as draft and published count as one', () => {
          const { labels } = mountClone(DRAFT, { persisted: true }, { stack: [DRAFT, POSITION, GROUP], pageDataOf: { [POSITION]: PAGE_DATA }, publishable: [['/component/c1', DRAFT]], byId: { ...slot, [PAGE_DATA]: { hero: '/component/c1' } } })

          expect(labels).toContain('Move')
        })

        test.each([
          ['the template\'s fallback, as the page data holds nothing', { hero: null }],
          ['another component than the page data holds', { hero: '/component/other' }],
        ])('does not offer Move from a slot showing %s', (_label, pageData) => {
          const { labels } = mountClone('/component/c1', { persisted: true }, { stack, pageDataOf: { [POSITION]: PAGE_DATA }, byId: { ...slot, [POSITION]: { ...slot[POSITION], component: '/component/c1' }, [PAGE_DATA]: pageData } })

          expect(labels).not.toContain('Move')
        })

        test('does not offer Move from a slot with no page data at its depth', () => {
          const { labels } = mountClone('/component/c1', { persisted: true }, { stack, byId: slot })

          expect(labels).not.toContain('Move')
        })

        test('choosing Move records the page data and property on screen, as the slot\'s position is the same on every page-data page', async () => {
          const { $cwa, button } = mountClone('/component/c1', { persisted: true }, { stack, pageDataOf: { [POSITION]: PAGE_DATA }, byId: { ...slot, [PAGE_DATA]: { hero: '/component/c1' } } })

          button.vm.$emit('select', { label: 'Move', value: 'move' })
          await flushPromises()

          expect($cwa.resources.pageDataIriOf).toHaveBeenCalledWith(POSITION)
          expect(useCloneMode($cwa as any).source.value?.move).toEqual({ positionIri: POSITION, fromLayout: false, from: { pageData: PAGE_DATA, property: 'hero' } })
        })
      })

      test('does not offer Move for a component being added', () => {
        const { labels } = mountClone('/component/c1', { persisted: false, adding: { instantAdd: false, endpoint: '/component/html_contents', isPublishable: true } }, { stack })

        expect(labels).not.toContain('Move')
      })

      test.each([false, true])('choosing Move starts move mode with the selected position and whether it is in the layout (%s), and empties the stack', async (isEditingLayout) => {
        const { $cwa, button, emptyStack } = mountClone('/component/c1', { persisted: true }, { stack, isEditingLayout, byId: { [POSITION]: { componentGroup: GROUP } } })

        button.vm.$emit('select', { label: 'Move', value: 'move' })
        await flushPromises()

        expect(useCloneMode($cwa as any).source.value).toEqual({ iri: '/component/c1', name: 'Hero Section', excerpt: 'Shared source component', positionIri: POSITION, move: { positionIri: POSITION, fromLayout: isEditingLayout, from: { componentPosition: POSITION } } })
        expect(emptyStack).toHaveBeenCalledTimes(1)
      })
    })
  })
})

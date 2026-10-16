// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CurrentResourceCta from './CurrentResourceCta.vue'
import * as cwaComposable from '#cwa/composables/cwa'

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

describe('CurrentResourceCta', () => {
  afterEach(() => {
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

    test.each([
      [groupIri, ['Add to Start', 'Add to End']],
      ['/component/c1', ['Add Before', 'Add After']],
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

      expect(labels).toEqual([])
    })
  })
})

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
})

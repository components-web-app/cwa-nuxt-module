import { describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'
import { instancesOf, onInstancesChange, registerInstance, unregisterInstance } from './manageable-instances'
import type Cwa from '#cwa/cwa'

const DRAFT_IRI = '/component/html_contents/draft'
const PUBLISHED_IRI = '/component/html_contents/published'

function buildCwa(publishable: Record<string, string[]> = {}) {
  return {
    resources: {
      findAllPublishableIris: vi.fn((iri: string) => publishable[iri] ?? [iri]),
    },
  } as unknown as Cwa
}

function elements(): Ref<HTMLElement[]> {
  return ref([{} as HTMLElement])
}

describe('manageable instances', () => {
  test('lists every mounted instance of an IRI', () => {
    const $cwa = buildCwa()
    const first = elements()
    const second = elements()
    registerInstance($cwa, '/component/a', first)
    registerInstance($cwa, '/component/a', second)
    registerInstance($cwa, '/component/b', elements())

    const instances = instancesOf($cwa, '/component/a')

    expect(instances).toHaveLength(2)
    expect(instances[0]).toBe(first)
    expect(instances[1]).toBe(second)
  })

  test('an instance of the draft and of the published component are listed together', () => {
    const $cwa = buildCwa({ [DRAFT_IRI]: [PUBLISHED_IRI, DRAFT_IRI] })
    const draft = elements()
    const published = elements()
    registerInstance($cwa, DRAFT_IRI, draft)
    registerInstance($cwa, PUBLISHED_IRI, published)

    const instances = instancesOf($cwa, DRAFT_IRI)

    expect(instances).toHaveLength(2)
    expect(instances).toContain(draft)
    expect(instances).toContain(published)
    expect($cwa.resources.findAllPublishableIris).toHaveBeenCalledWith(DRAFT_IRI)
  })

  test('an unmounted instance is no longer listed', () => {
    const $cwa = buildCwa()
    const first = elements()
    const second = elements()
    registerInstance($cwa, '/component/a', first)
    registerInstance($cwa, '/component/a', second)

    unregisterInstance($cwa, '/component/a', first)

    const instances = instancesOf($cwa, '/component/a')
    expect(instances).toHaveLength(1)
    expect(instances[0]).toBe(second)
  })

  test('lists nothing without an IRI', () => {
    const $cwa = buildCwa()
    registerInstance($cwa, '/component/a', elements())

    expect(instancesOf($cwa, undefined)).toEqual([])
    expect($cwa.resources.findAllPublishableIris).not.toHaveBeenCalled()
  })

  test('instances are kept apart per Cwa instance', () => {
    const $cwa = buildCwa()
    registerInstance(buildCwa(), '/component/a', elements())

    expect(instancesOf($cwa, '/component/a')).toEqual([])
  })

  test('tells listeners when an instance is registered or unregistered', () => {
    const $cwa = buildCwa()
    const listener = vi.fn()
    const stop = onInstancesChange($cwa, listener)
    const first = elements()

    registerInstance($cwa, '/component/a', first)
    expect(listener).toHaveBeenCalledTimes(1)

    registerInstance($cwa, '/component/a', first)
    unregisterInstance($cwa, '/component/a', elements())
    expect(listener).toHaveBeenCalledTimes(1)

    unregisterInstance($cwa, '/component/a', first)
    expect(listener).toHaveBeenCalledTimes(2)

    stop()
    registerInstance($cwa, '/component/a', first)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  test('does not tell listeners of another Cwa instance', () => {
    const listener = vi.fn()
    onInstancesChange(buildCwa(), listener)

    registerInstance(buildCwa(), '/component/a', elements())

    expect(listener).not.toHaveBeenCalled()
  })
})

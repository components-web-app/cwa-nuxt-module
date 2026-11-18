import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { usePublishState } from './publish-state'

const NOW = new Date('2026-09-25T12:00:00Z')

function setup(data: Record<string, any>) {
  const state = reactive<Record<string, any>>({})
  const resource = ref(data)
  let finish: (saved?: unknown) => void = () => {}
  const updateResource = vi.fn(() => new Promise<unknown>((resolve) => {
    finish = resolve
  }))
  const $cwa = {
    admin: {
      resourceStackManager: {
        getState: (key: string) => state[key],
        setState: (key: string, value: any) => {
          state[key] = value
        },
      },
    },
    resources: { getResource: () => ({ value: { data: resource.value } }) },
    resourcesManager: { updateResource },
  }
  const publish = usePublishState($cwa as any, ref('/component/c1'))
  return { publish, updateResource, resource, finish: (saved?: unknown) => finish(saved) }
}

const draft = (publishedAt?: string) => ({ '@id': '/component/c1', publishedAt, '_metadata': { publishable: { published: false } } })

describe('usePublishState (#459)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  test('a draft not being scheduled publishes now, sending "now" for the API\'s clock (#381), and is saving until the request ends', async () => {
    const { publish, updateResource, finish } = setup(draft())

    expect(publish.action.value).toBe('Publish now')
    const running = publish.run()
    expect(updateResource).toHaveBeenCalledWith({ endpoint: '/component/c1', data: { publishedAt: 'now' } })
    expect(publish.saving.value).toBe(true)
    finish()
    await running
    expect(publish.saving.value).toBe(false)
  })

  test('scheduling sends the chosen time, and nothing until one is chosen', () => {
    const { publish, updateResource } = setup(draft())

    publish.scheduling.value = true
    expect(publish.action.value).toBe('Schedule')
    publish.run()
    expect(updateResource).not.toHaveBeenCalled()

    publish.scheduleValue.value = '2026-10-01T08:00:00.000Z'
    publish.run()
    expect(updateResource).toHaveBeenCalledWith({ endpoint: '/component/c1', data: { publishedAt: '2026-10-01T08:00:00.000Z' } })
  })

  test('a chosen time already past when saved publishes now (#381)', () => {
    const { publish, updateResource } = setup(draft())

    publish.scheduling.value = true
    publish.scheduleValue.value = '2026-09-25T11:00:00.000Z'
    publish.run()
    expect(updateResource).toHaveBeenCalledWith({ endpoint: '/component/c1', data: { publishedAt: 'now' } })
  })

  test('a scheduled draft starts with scheduling on and its date chosen, and Cancel schedule clears it', () => {
    const { publish, updateResource } = setup(draft('2026-10-01T08:00:00+00:00'))

    expect(publish.scheduledAt.value).toBe('2026-10-01T08:00:00+00:00')
    expect(publish.scheduling.value).toBe(true)
    expect(publish.scheduleValue.value).toBe('2026-10-01T08:00:00+00:00')
    publish.cancelSchedule()
    expect(updateResource).toHaveBeenCalledWith({ endpoint: '/component/c1', data: { publishedAt: null } })
  })

  test('a publish the API refuses is marked failed, and Retry sends it again, clearing the failure once it is saved', async () => {
    const { publish, updateResource, finish } = setup(draft())

    const first = publish.run()
    finish()
    await first
    expect(publish.failed.value).toBe(true)

    const again = publish.retry()
    expect(updateResource).toHaveBeenLastCalledWith({ endpoint: '/component/c1', data: { publishedAt: 'now' } })
    finish({ '@id': '/component/c1' })
    await again
    expect(updateResource).toHaveBeenCalledTimes(2)
    expect(publish.failed.value).toBe(false)
  })

  test('a failed schedule retried after its time has passed publishes now (#381)', async () => {
    const { publish, updateResource, finish } = setup(draft())
    publish.scheduling.value = true
    publish.scheduleValue.value = '2026-09-25T12:05:00.000Z'

    const first = publish.run()
    finish()
    await first
    vi.setSystemTime(new Date('2026-09-25T12:10:00Z'))
    publish.retry()

    expect(updateResource).toHaveBeenLastCalledWith({ endpoint: '/component/c1', data: { publishedAt: 'now' } })
  })

  test('a second press while publishing sends nothing more', () => {
    const { publish, updateResource } = setup(draft())

    publish.run()
    publish.run()
    publish.cancelSchedule()

    expect(updateResource).toHaveBeenCalledTimes(1)
  })

  test('a live resource has no publish action', () => {
    const { publish } = setup({ '@id': '/component/c1', 'publishedAt': '2026-01-01T00:00:00Z', '_metadata': { publishable: { published: true } } })

    expect(publish.action.value).toBeUndefined()
    expect(publish.scheduledAt.value).toBeUndefined()
  })
})

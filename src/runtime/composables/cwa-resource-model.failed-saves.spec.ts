// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, nextTick, reactive, ref } from 'vue'
import { useCwaResourceModel } from '#cwa/composables/cwa-resource-model'
import { failedSaves, forgetFailedSave } from '#cwa/admin/field-states'
import { labelModelField } from '#cwa/resources/model-editors'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return { ...mod, onBeforeUnmount: vi.fn(), getCurrentInstance: vi.fn().mockReturnValue(null) }
})

const fake = vi.hoisted(() => ({ $cwa: undefined as any, endpoint: { value: '/component/a' } }))
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => fake.$cwa }))
vi.mock('#cwa/composables/cwa-resource-endpoint', () => ({ useCwaResourceEndpoint: () => ({ endpoint: fake.endpoint }) }))
vi.mock('#cwa/resources/realtime-view', () => ({ realtimeView: () => ({ view: { value: undefined }, load: vi.fn().mockResolvedValue(undefined) }) }))

const A = '/component/a'
const B = '/component/b'

let store: Record<string, any>
let answers: ((outcome: { resource?: any, error?: any }) => void)[]
const serverError = () => Object.assign(new Error('Server Error'), { statusCode: 500, data: { detail: 'Boom' } })

async function microtasks() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve()
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  store = reactive({ [A]: { data: { '@id': A, 'title': 'Stored A' } }, [B]: { data: { '@id': B, 'title': 'Stored B' } } })
  answers = []
  fake.endpoint.value = A
  fake.$cwa = {
    resources: {
      getResource: (iri: string) => computed(() => store[iri]),
      findAllPublishableIris: (iri: string) => [iri],
    },
    resourcesManager: {
      getWaitForRequestPromise: vi.fn().mockResolvedValue(undefined),
      registerPendingUpdate: vi.fn(() => () => {}),
      updateResource: vi.fn((event: { endpoint: string, onRequest?: (iri: string, done: Promise<unknown>) => void }) => new Promise((resolve) => {
        let settle!: (outcome: unknown) => void
        const done = new Promise((answered) => {
          settle = answered
        })
        event.onRequest?.(event.endpoint.split('?')[0]!, done)
        answers.push((outcome) => {
          settle(outcome)
          resolve(outcome.resource)
        })
      })),
    },
  }
})

afterEach(() => {
  vi.useRealTimers()
})

async function failAfterMovingOn() {
  const iri = ref<string | undefined>(A)
  const field = useCwaResourceModel<string>(iri, 'title')
  labelModelField(field.editorKey, 'Heading')
  field.model.value = 'Mine'
  await nextTick()
  vi.runAllTimers()
  await microtasks()
  iri.value = B
  fake.endpoint.value = B
  answers[0]!({ error: serverError() })
  await vi.waitFor(() => expect(store[A].fieldStates?.title?.status).toBe('error'))
  return { iri, field }
}

describe('a failed field save can be retried and reset after the field has gone from the bar (#461)', () => {
  test('a failed save is tracked with the IRI it was sent to, its field and the label its Field gave it; a save that succeeds is not', async () => {
    const { field } = await failAfterMovingOn()
    const [save, ...others] = failedSaves(fake.$cwa).values()

    expect(others).toHaveLength(0)
    expect(save).toMatchObject({ iri: A, field: 'title' })
    expect(save!.label()).toBe('Heading')
    labelModelField(field.editorKey, undefined)
    expect(save!.label()).toBe('title')

    const iri = ref<string | undefined>(B)
    const other = useCwaResourceModel<string>(iri, 'title')
    other.model.value = 'Fine'
    await nextTick()
    vi.runAllTimers()
    await microtasks()
    answers[1]!({ resource: { '@id': B, 'title': 'Fine' } })
    await microtasks()
    expect(failedSaves(fake.$cwa).size).toBe(1)
  })

  test('Retry sends the failed change again to where it was typed, though the model has moved on, and its success leaves the field saved with no local value', async () => {
    const { iri, field } = await failAfterMovingOn()
    const [save] = failedSaves(fake.$cwa).values()

    save!.retry()
    await microtasks()

    expect(fake.$cwa.resourcesManager.updateResource).toHaveBeenCalledTimes(2)
    expect(fake.$cwa.resourcesManager.updateResource).toHaveBeenLastCalledWith(expect.objectContaining({ endpoint: A, data: { title: 'Mine' } }))
    await vi.waitFor(() => expect(store[A].fieldStates.title.status).toBe('saving'))
    store[A].data = { '@id': A, 'title': 'Mine' }
    answers[1]!({ resource: { '@id': A, 'title': 'Mine' } })
    await vi.waitFor(() => expect(store[A].fieldStates.title.status).toBe('saved'))
    expect(field.localValueWithIri.value[A]).toBeUndefined()
    iri.value = A
    expect(field.model.value).toBe('Mine')
  })

  test('a Retry that fails is tracked again', async () => {
    await failAfterMovingOn()
    const [save] = failedSaves(fake.$cwa).values()
    forgetFailedSave(fake.$cwa, save!)
    expect(failedSaves(fake.$cwa).size).toBe(0)

    save!.retry()
    await microtasks()
    answers[1]!({ error: serverError() })
    await vi.waitFor(() => expect(failedSaves(fake.$cwa).size).toBe(1))
  })

  test('Reset clears the field\'s state and its local value, so it shows the stored value again, and sends nothing', async () => {
    const { iri, field } = await failAfterMovingOn()
    const [save] = failedSaves(fake.$cwa).values()
    expect(field.localValueWithIri.value[A]).toBe('Mine')

    save!.reset()

    await vi.waitFor(() => expect(store[A].fieldStates?.title).toBeUndefined())
    iri.value = A
    expect(field.model.value).toBe('Stored A')
    expect(fake.$cwa.resourcesManager.updateResource).toHaveBeenCalledOnce()
  })
})

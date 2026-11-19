import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { registerBarFields, unclaimedViolations } from './write-violations'
import { ErrorType } from '#cwa/storage/stores/error/state'
import type { CwaErrorEvent, CwaViolationError } from '#cwa/storage/stores/error/state'
import { CwaResourceApiStatuses, NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import type { CwaCurrentResourceInterface } from '#cwa/storage/stores/resources/state'
import type Cwa from '#cwa/cwa'

const DRAFT = '/component/images/draft'
const LIVE = '/component/images/live'
const OTHER = '/component/titles/other'
const MISSING_FILE = 'A file must be uploaded for the `file` field before publishing.'

function entry(iri: string, data: Record<string, unknown> = {}): CwaCurrentResourceInterface {
  return { apiState: { status: CwaResourceApiStatuses.SUCCESS, headers: {}, fetchedAt: 0 }, data: { '@id': iri, '@type': 'Image', '_metadata': { persisted: true }, ...data } } as CwaCurrentResourceInterface
}

let unregister: (() => void) | undefined

function setup(current: string = DRAFT, fields = ['alt', 'file']) {
  const entries = reactive<Record<string, CwaCurrentResourceInterface>>({
    [DRAFT]: entry(DRAFT, { publishedResource: LIVE }),
    [LIVE]: entry(LIVE),
    [OTHER]: entry(OTHER),
    [NEW_RESOURCE_IRI]: entry(NEW_RESOURCE_IRI, { _metadata: { persisted: false, adding: { endpoint: '/component/images' } } }),
  })
  const $cwa = {
    resources: {
      getResource: (iri: string) => computed(() => entries[iri]),
      findAllPublishableIris: (iri: string) => [DRAFT, LIVE].includes(iri) ? [DRAFT, LIVE] : [iri],
    },
    resourcesManager: {} as { writeSaved?: (event: { endpoint: string, data: unknown }) => void },
  }
  const show = vi.fn()
  unregister = registerBarFields($cwa as unknown as Cwa, { iri: () => current, fields: () => fields, show })
  const claim = (error: CwaErrorEvent) => unclaimedViolations($cwa as unknown as Cwa, error)
  return { $cwa, entries, show, claim }
}

let timestamp = 0

function refused(violations: CwaViolationError[], event: CwaErrorEvent['event'] = { endpoint: DRAFT, data: { publishedAt: 'now' } }): CwaErrorEvent {
  return reactive({ type: ErrorType.VALIDATION, statusCode: 422, detail: '', violations, timestamp: ++timestamp, event }) as CwaErrorEvent
}

const fileViolation = { property: 'file', message: MISSING_FILE }
const creditViolation = { property: 'credit', message: 'This value is too long.' }

afterEach(() => {
  unregister?.()
})

describe('a refused write of the selected resource puts its violations on the bar\'s fields (#461)', () => {
  test('a publish refused for the file and for a property no tab shows puts the error on the file field, shows its tab, and leaves only the other for the toast', async () => {
    const { entries, show, claim } = setup()

    expect(claim(refused([fileViolation, creditViolation]))).toEqual([creditViolation])

    await vi.waitFor(() => expect(entries[DRAFT]!.fieldStates?.file).toStrictEqual({
      status: 'error',
      waiting: false,
      slow: false,
      error: { kind: 'violation', status: 422, message: MISSING_FILE },
    }))
    expect(entries[DRAFT]!.fieldStates?.credit).toBeUndefined()
    expect(show).toHaveBeenCalledExactlyOnceWith('file')
  })

  test('when every violation is on a field, nothing is left for the toast', () => {
    const { claim } = setup()

    expect(claim(refused([fileViolation]))).toEqual([])
  })

  test('the tab shown is the one holding the first field in tab order, and a nested path is its root field\'s', async () => {
    const { entries, show, claim } = setup()

    claim(refused([{ property: 'file.mimeType', message: 'Not an image.' }, { property: 'alt', message: 'Describe the image.' }]))

    expect(show).toHaveBeenCalledExactlyOnceWith('alt')
    await vi.waitFor(() => expect(entries[DRAFT]!.fieldStates?.file?.error?.message).toBe('Not an image.'))
  })

  test('a write to the live version of the selected draft counts as the selected resource, and its fields are the draft\'s', async () => {
    const { entries, claim } = setup()

    expect(claim(refused([fileViolation], { endpoint: `${LIVE}?published=true`, data: { publishedAt: 'now' } }))).toEqual([])
    await vi.waitFor(() => expect(entries[DRAFT]!.fieldStates?.file?.status).toBe('error'))
  })

  test('a refusal for another resource, a field model\'s own save, an error that is not a 422, or a closed bar is left to the toast as before', async () => {
    const { entries, show, claim } = setup()
    const forOther = refused([fileViolation], { endpoint: OTHER, data: { title: '' } })
    const fromModel = refused([fileViolation], { endpoint: DRAFT, data: { file: null }, onRequest: () => {} })
    const notValidation = { ...refused([fileViolation]), statusCode: 400 } as CwaErrorEvent

    expect(claim(forOther)).toEqual([fileViolation])
    expect(claim(fromModel)).toEqual([fileViolation])
    expect(claim(notValidation)).toEqual([fileViolation])
    unregister?.()
    expect(claim(refused([fileViolation]))).toEqual([fileViolation])

    await Promise.resolve()
    expect(entries[DRAFT]!.fieldStates).toBeUndefined()
    expect(show).not.toHaveBeenCalled()
  })

  test('a refused Add of the component being added puts its violations on its fields', async () => {
    const { entries, claim } = setup(NEW_RESOURCE_IRI)

    expect(claim(refused([fileViolation], { endpoint: '/component/images', data: { publishedAt: 'now' } }))).toEqual([])
    await vi.waitFor(() => expect(entries[NEW_RESOURCE_IRI]!.fieldStates?.file?.status).toBe('error'))
  })

  test('each error is claimed once, so the toast\'s later renders neither switch tab again nor rewrite the field', () => {
    const { show, claim } = setup()
    const error = refused([fileViolation, creditViolation])

    claim(error)
    expect(claim(error)).toEqual([creditViolation])

    expect(show).toHaveBeenCalledOnce()
  })

  test('a later successful write of the resource clears the errors the refusal put on its fields', async () => {
    const { $cwa, entries, claim } = setup()
    claim(refused([fileViolation]))
    await vi.waitFor(() => expect(entries[DRAFT]!.fieldStates?.file?.status).toBe('error'))

    $cwa.resourcesManager.writeSaved!({ endpoint: LIVE, data: { publishedAt: 'now' } })

    await vi.waitFor(() => expect(entries[DRAFT]!.fieldStates?.file).toBeUndefined())
  })
})

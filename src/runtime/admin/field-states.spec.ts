import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { reactive } from 'vue'
import { edited, failed, held, cleared, settled, skipped, started, succeeded, unqueued } from './field-states'
import type { CwaCurrentResourceInterface } from '#cwa/storage/stores/resources/state'
import { CwaResourceApiStatuses } from '#cwa/storage/stores/resources/state'

function entry(): CwaCurrentResourceInterface {
  return reactive({ apiState: { status: CwaResourceApiStatuses.SUCCESS, headers: {}, fetchedAt: 0 }, data: { '@id': '/component/titles/1', '@type': 'Title' } }) as CwaCurrentResourceInterface
}

function httpError(statusCode: number | undefined, data?: unknown) {
  return Object.assign(new Error('Request failed'), { statusCode, data })
}

describe('field states (#458)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('nothing is written until a field changes, and the key appears on the first write', () => {
    const title = entry()
    expect(title.fieldStates).toBeUndefined()

    edited(title, 'title')

    expect(title.fieldStates).toStrictEqual({ title: { status: 'pending', waiting: true, slow: false } })
  })

  test('a save goes pending, saving, then saved with the time it landed', () => {
    const title = entry()
    edited(title, 'title')
    unqueued(title, 'title')
    started(title, ['title'])
    expect(title.fieldStates?.title).toStrictEqual({ status: 'saving', waiting: false, slow: false })

    succeeded(title, ['title'])

    expect(title.fieldStates?.title).toStrictEqual({ status: 'saved', waiting: false, slow: false, savedAt: 1_000_000 })
  })

  test('the status stays saving for the whole episode while a follow-up is waiting, and becomes saved when nothing is left to send', () => {
    const title = entry()
    started(title, ['title'])
    edited(title, 'title')

    succeeded(title, ['title'])
    expect(title.fieldStates?.title?.status).toBe('saving')
    expect(title.fieldStates?.title?.waiting).toBe(true)

    skipped(title, 'title')
    expect(title.fieldStates?.title).toMatchObject({ status: 'saved', waiting: false })
  })

  test('a change typed back to the stored value before it is sent leaves no state', () => {
    const title = entry()
    edited(title, 'title')

    skipped(title, 'title')

    expect(title.fieldStates?.title).toBeUndefined()
  })

  test('one field\'s success never clears another field\'s error', () => {
    const page = entry()
    started(page, ['title'])
    failed(page, ['title'], httpError(500, { detail: 'Boom' }))
    started(page, ['reference'])

    succeeded(page, ['reference'])

    expect(page.fieldStates?.title).toMatchObject({ status: 'error', error: { kind: 'server', status: 500, message: 'Boom' } })
    expect(page.fieldStates?.reference?.status).toBe('saved')
  })

  test('a 422 gives each field sent its own violation, and the request\'s detail to a field sent without one', () => {
    const page = entry()
    started(page, ['title', 'reference'])

    failed(page, ['title', 'reference'], httpError(422, {
      detail: 'title: Add a title.',
      violations: [{ propertyPath: 'title', message: 'Add a title.' }],
    }))

    expect(page.fieldStates?.title?.error).toStrictEqual({ kind: 'violation', status: 422, message: 'Add a title.' })
    expect(page.fieldStates?.reference?.error).toStrictEqual({ kind: 'violation', status: 422, message: 'title: Add a title.' })
  })

  test('a violation on a nested property belongs to its root field', () => {
    const page = entry()
    started(page, ['address'])

    failed(page, ['address'], httpError(422, { detail: 'x', violations: [{ propertyPath: 'address.city', message: 'Add a city.' }] }))

    expect(page.fieldStates?.address?.error?.message).toBe('Add a city.')
  })

  test('a request that never reached the server is a network error', () => {
    const title = entry()
    started(title, ['title'])

    failed(title, ['title'], httpError(undefined))

    expect(title.fieldStates?.title?.error).toMatchObject({ kind: 'network' })
    expect(title.fieldStates?.title?.error?.status).toBeUndefined()
  })

  test('a 412 for a field no editor holds a conflict for is an error, never a conflict, whatever the body holds', () => {
    const title = entry()
    started(title, ['title'])

    failed(title, ['title'], httpError(412, { '@id': '/component/titles/1', 'title': 'theirs' }))

    expect(title.fieldStates?.title).toStrictEqual({
      status: 'error',
      waiting: false,
      slow: false,
      error: { kind: 'precondition', status: 412, message: 'Someone else saved this first, so your change was not saved.' },
    })
  })

  test('a 412 settling after the editor already took Keep mine and resent leaves no conflict once the resend lands', () => {
    const title = entry()
    started(title, ['title'])
    held(title, 'title', { user: { id: '/_/users/2', name: 'Mia' }, value: 'theirs' })
    held(title, 'title', undefined)
    started(title, ['title'])

    failed(title, ['title'], httpError(412, { '@id': '/component/titles/1', 'title': 'theirs' }))
    succeeded(title, ['title'])

    expect(title.fieldStates?.title).toMatchObject({ status: 'saved' })
    expect(title.fieldStates?.title?.held).toBeUndefined()
  })

  test('a held conflict is kept by a 412 as plain data', () => {
    const title = entry()
    started(title, ['title'])
    held(title, 'title', { value: 'theirs' })

    failed(title, ['title'], httpError(412, { '@id': '/component/titles/1', 'title': 'other' }))

    expect(title.fieldStates?.title).toMatchObject({ status: 'conflict', held: { value: 'theirs' }, error: { kind: 'precondition' } })
    expect(JSON.parse(JSON.stringify(title.fieldStates))).toStrictEqual(title.fieldStates)
  })

  test('a 412 keeps the conflict the editor already raised with its peer, and goes to the draft the server answered with', () => {
    const live = entry()
    const draft = entry()
    started(live, ['title'])
    held(draft, 'title', { user: { id: '/_/users/2', name: 'Mia' }, value: 'theirs' })

    failed(live, ['title'], httpError(412, { '@id': '/component/titles/draft', 'title': 'theirs' }), draft)

    expect(live.fieldStates?.title).toBeUndefined()
    expect(draft.fieldStates?.title).toMatchObject({ status: 'conflict', held: { user: { id: '/_/users/2', name: 'Mia' }, value: 'theirs' }, error: { kind: 'precondition' } })
  })

  test('a save creating a draft moves the field\'s state to the draft', () => {
    const live = entry()
    const draft = entry()
    started(live, ['title'])
    edited(live, 'title')

    succeeded(live, ['title'], draft)

    expect(live.fieldStates?.title).toBeUndefined()
    expect(draft.fieldStates?.title).toMatchObject({ status: 'saving', waiting: true })
  })

  test('a settled request goes to the resource the server answered with: the response, or the body of a 412, never another error\'s body', () => {
    const sent = entry()
    const draft = entry()
    const find = (iri: string) => iri === '/component/titles/draft' ? draft : undefined

    started(sent, ['title'])
    settled(sent, ['title'], { '@id': '/component/titles/draft', '@type': 'Title' }, undefined, find)
    expect(draft.fieldStates?.title?.status).toBe('saved')

    started(sent, ['subtitle'])
    settled(sent, ['subtitle'], undefined, httpError(412, { '@id': '/component/titles/draft', 'subtitle': 'theirs' }), find)
    expect(draft.fieldStates?.subtitle?.error?.kind).toBe('precondition')
    expect(sent.fieldStates?.subtitle).toBeUndefined()

    started(sent, ['reference'])
    settled(sent, ['reference'], undefined, httpError(422, { '@id': '/component/titles/draft', 'detail': 'Bad' }), find)
    expect(sent.fieldStates?.reference?.status).toBe('error')
    expect(draft.fieldStates?.reference).toBeUndefined()
  })

  test('a request in flight for more than a second is slow, until nothing is in flight', () => {
    const title = entry()
    started(title, ['title'])
    vi.advanceTimersByTime(999)
    expect(title.fieldStates?.title?.slow).toBe(false)
    vi.advanceTimersByTime(1)
    expect(title.fieldStates?.title?.slow).toBe(true)

    succeeded(title, ['title'])

    expect(title.fieldStates?.title?.slow).toBe(false)
  })

  test('a request that settles before a second is never slow', () => {
    const title = entry()
    started(title, ['title'])
    succeeded(title, ['title'])
    vi.advanceTimersByTime(5000)

    expect(title.fieldStates?.title?.slow).toBe(false)
  })

  test('a later request is slow a second after it started, not after an earlier one did', () => {
    const title = entry()
    started(title, ['title'])
    vi.advanceTimersByTime(500)
    succeeded(title, ['title'])
    vi.advanceTimersByTime(100)
    started(title, ['title'])

    vi.advanceTimersByTime(999)
    expect(title.fieldStates?.title?.slow).toBe(false)
    vi.advanceTimersByTime(1)
    expect(title.fieldStates?.title?.slow).toBe(true)
  })

  test('a second request for the field keeps it saving until both have settled', () => {
    const title = entry()
    started(title, ['title'])
    started(title, ['title'])

    succeeded(title, ['title'])
    expect(title.fieldStates?.title?.status).toBe('saving')

    succeeded(title, ['title'])
    expect(title.fieldStates?.title?.status).toBe('saved')
  })

  test('sending clears an earlier error and held conflict, and typing clears an error but keeps a conflict', () => {
    const title = entry()
    started(title, ['title'])
    failed(title, ['title'], httpError(500, { detail: 'Boom' }))
    edited(title, 'title')
    expect(title.fieldStates?.title).toStrictEqual({ status: 'pending', waiting: true, slow: false })

    held(title, 'title', { value: 'theirs' })
    edited(title, 'title')
    expect(title.fieldStates?.title?.status).toBe('conflict')

    started(title, ['title'])
    expect(title.fieldStates?.title).toStrictEqual({ status: 'saving', waiting: true, slow: false })
  })

  test('a conflict raised while a save is in flight survives that save', () => {
    const title = entry()
    started(title, ['title'])
    held(title, 'title', { value: 'theirs' })

    succeeded(title, ['title'])

    expect(title.fieldStates?.title).toMatchObject({ status: 'conflict', held: { value: 'theirs' } })
  })

  test('clearing a conflict goes back to saving, pending or no state', () => {
    const title = entry()
    held(title, 'title', { value: 'theirs' })
    held(title, 'title', undefined)
    expect(title.fieldStates?.title).toBeUndefined()

    edited(title, 'title')
    held(title, 'title', { value: 'theirs' })
    held(title, 'title', undefined)
    expect(title.fieldStates?.title?.status).toBe('pending')

    started(title, ['title'])
    held(title, 'title', { value: 'theirs' })
    held(title, 'title', undefined)
    expect(title.fieldStates?.title?.status).toBe('saving')
  })

  test('a waiting change dropped once its conflict is cleared, as Use theirs does, leaves no state', () => {
    const title = entry()
    held(title, 'title', { value: 'theirs' })
    edited(title, 'title')
    held(title, 'title', undefined)

    unqueued(title, 'title')

    expect(title.fieldStates?.title).toBeUndefined()
  })

  test('a change taken off the queue while a request for the field is in flight stays saving', () => {
    const title = entry()
    started(title, ['title'])
    edited(title, 'title')

    unqueued(title, 'title')

    expect(title.fieldStates?.title).toStrictEqual({ status: 'saving', waiting: false, slow: false })
  })

  test('reset clears the field\'s state', () => {
    const title = entry()
    started(title, ['title'])
    failed(title, ['title'], httpError(500, { detail: 'Boom' }))

    cleared(title, 'title')

    expect(title.fieldStates?.title).toBeUndefined()
  })

  test('a resource no longer in the store is ignored', () => {
    expect(() => {
      edited(undefined, 'title')
      started(undefined, ['title'])
      succeeded(undefined, ['title'])
      failed(undefined, ['title'], httpError(500))
      held(undefined, 'title', { value: 1 })
      skipped(undefined, 'title')
      cleared(undefined, 'title')
      unqueued(undefined, 'title')
    }).not.toThrow()
  })
})

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { KIT_DEBOUNCE, KIT_SAVE_DELAY, KIT_SLOW_DELAY, createFakeSaveServer, kitMia, liveFieldModel } from './fake-save-server'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

async function typeAndSettle(model: { model: { value: unknown } }, value: unknown, wait = KIT_DEBOUNCE + KIT_SAVE_DELAY) {
  model.model.value = value
  await vi.advanceTimersByTimeAsync(wait)
}

describe('the /kit fake save adapter drives the real field-state functions', () => {
  test('typing waits, saves after the debounce, then shows saved', async () => {
    const server = createFakeSaveServer()
    const title = liveFieldModel(server, 'title', 'Kitchens')
    title.model.value = 'Kitchens!'
    expect(title.state.value).toMatchObject({ status: 'pending', waiting: true })
    await vi.advanceTimersByTimeAsync(KIT_DEBOUNCE)
    expect(title.state.value.status).toBe('saving')
    await vi.advanceTimersByTimeAsync(KIT_SAVE_DELAY)
    expect(title.state.value.status).toBe('saved')
    expect(title.saved.value).toBe('Kitchens!')
    expect(server.state.requests).toBe(1)
  })

  test('make the next save fail with a 422 shows the field\'s violation, and only the next save fails', async () => {
    const server = createFakeSaveServer()
    const title = liveFieldModel(server, 'title', 'Kitchens')
    server.failNext('422')
    await typeAndSettle(title, 'Taken')
    expect(title.state.value).toMatchObject({ status: 'error', error: { kind: 'violation', status: 422, message: 'This value is already used by another page.' } })
    void title.retry!()
    await vi.advanceTimersByTimeAsync(KIT_SAVE_DELAY)
    expect(title.state.value.status).toBe('saved')
  })

  test('a 500 is a server error and offline is a network error with no status', async () => {
    const server = createFakeSaveServer()
    const title = liveFieldModel(server, 'title', 'Kitchens')
    server.failNext('500')
    await typeAndSettle(title, 'A')
    expect(title.state.value.error).toMatchObject({ kind: 'server', status: 500 })
    server.state.offline = true
    await typeAndSettle(title, 'B')
    expect(title.state.value.error).toEqual({ kind: 'network', message: 'The connection dropped.' })
    await typeAndSettle(title, 'C')
    expect(title.state.value.status).toBe('error')
  })

  test('a 412 holds Mia\'s value as a conflict; Keep mine saves mine, Use theirs takes hers without saving', async () => {
    const server = createFakeSaveServer()
    server.theirs.title = 'Mia\'s title'
    const title = liveFieldModel(server, 'title', 'Kitchens')
    server.failNext('412')
    await typeAndSettle(title, 'Mine')
    expect(title.state.value).toMatchObject({ status: 'conflict', error: { kind: 'precondition' }, held: { user: { name: 'Mia' }, value: 'Mia\'s title' } })
    expect(title.remoteChange.value).toMatchObject({ name: 'Mia', value: 'Mia\'s title' })
    title.remoteChange.value!.keep()
    await vi.advanceTimersByTimeAsync(KIT_SAVE_DELAY)
    expect(title.state.value.status).toBe('saved')
    expect(title.saved.value).toBe('Mine')

    server.failNext('412')
    await typeAndSettle(title, 'Mine again')
    const requests = server.state.requests
    title.remoteChange.value!.accept()
    expect(title.model.value).toBe('Mia\'s title')
    expect(title.state.value.status).toBe('idle')
    expect(server.state.requests).toBe(requests)
  })

  test('slow saves take four seconds and are marked slow after one', async () => {
    const server = createFakeSaveServer()
    server.state.slow = true
    const title = liveFieldModel(server, 'title', 'Kitchens')
    title.model.value = 'Slow'
    await vi.advanceTimersByTimeAsync(KIT_DEBOUNCE + 1000)
    expect(title.state.value).toMatchObject({ status: 'saving', slow: true })
    await vi.advanceTimersByTimeAsync(KIT_SLOW_DELAY)
    expect(title.state.value.status).toBe('saved')
  })

  test('a remote change with nothing unsent here is applied; one landing while you type becomes a conflict', async () => {
    const server = createFakeSaveServer()
    const title = liveFieldModel(server, 'title', 'Kitchens')
    title.remote('Mia typed this')
    expect(title.model.value).toBe('Mia typed this')
    expect(title.state.value.status).toBe('idle')
    title.model.value = 'I am typing'
    title.remote('Mia saved this')
    expect(title.state.value).toMatchObject({ status: 'conflict', held: { value: 'Mia saved this' } })
    await vi.advanceTimersByTimeAsync(KIT_DEBOUNCE + KIT_SAVE_DELAY)
    expect(server.state.requests).toBe(0)
  })

  test('a remote change armed for the next keystroke lands on it and holds the typed value unsent', async () => {
    const server = createFakeSaveServer()
    const title = liveFieldModel(server, 'title', 'Kitchens')
    title.armRemoteOnNextEdit('Mia was first')
    title.model.value = 'K'
    expect(title.state.value).toMatchObject({ status: 'conflict', held: { value: 'Mia was first' } })
    expect(title.model.value).toBe('K')
    await vi.advanceTimersByTimeAsync(KIT_DEBOUNCE + KIT_SAVE_DELAY)
    expect(server.state.requests).toBe(0)
  })

  test('Reset puts back the last saved value and clears the state', async () => {
    const server = createFakeSaveServer()
    const title = liveFieldModel(server, 'title', 'Kitchens')
    server.failNext('500')
    await typeAndSettle(title, 'Broken')
    await title.reset!()
    expect(title.model.value).toBe('Kitchens')
    expect(title.state.value.status).toBe('idle')
  })

  test('forcing a state uses the same functions, so each looks as it does after a real save', () => {
    const title = liveFieldModel(createFakeSaveServer(), 'title', 'Kitchens')
    title.force('saving')
    expect(title.state.value.status).toBe('saving')
    title.force('saved')
    expect(title.state.value).toMatchObject({ status: 'saved', savedAt: expect.any(Number) })
    title.force('error')
    expect(title.state.value.error?.kind).toBe('network')
    title.force('conflict', 'Theirs')
    expect(title.remoteChange.value?.value).toBe('Theirs')
    title.force('pending')
    expect(title.state.value).toMatchObject({ status: 'pending', waiting: true })
    title.force('idle')
    expect(title.state.value.status).toBe('idle')
  })

  test('a peer added to the field shows in focusedBy', () => {
    const title = liveFieldModel(createFakeSaveServer(), 'title', 'Kitchens')
    title.peers.value = [kitMia]
    expect(title.focusedBy!.value.map(peer => peer.name)).toEqual(['Mia'])
  })

  test('make the next route action fail fails once; offline fails every route action', async () => {
    const server = createFakeSaveServer()
    server.failNextRouteAction()
    const first = server.routeAction()
    const firstResult = expect(first).rejects.toMatchObject({ statusCode: 500 })
    await vi.advanceTimersByTimeAsync(KIT_SAVE_DELAY)
    await firstResult
    const second = server.routeAction()
    await vi.advanceTimersByTimeAsync(KIT_SAVE_DELAY)
    await expect(second).resolves.toBeUndefined()
    server.state.offline = true
    const third = server.routeAction()
    const thirdResult = expect(third).rejects.toEqual({ message: 'The connection dropped.' })
    await vi.advanceTimersByTimeAsync(KIT_SAVE_DELAY)
    await thirdResult
  })
})

import { describe, expect, test, vi } from 'vitest'
import { createApp, shallowRef } from 'vue'
import { createConfirmDialog } from 'vuejs-confirm-dialog'
import { confirmChoice, confirmResourceAction, editingNotice } from './resource-confirm'
import type { RealtimePeer } from './presence'
import type Cwa from '#cwa/cwa'

const reveal = vi.hoisted(() => vi.fn())
vi.mock('vuejs-confirm-dialog', () => ({
  install: vi.fn(),
  createConfirmDialog: vi.fn(() => ({ reveal })),
}))
vi.mock('#cwa/templates/components/core/ui/Confirm.vue', () => ({ default: { name: 'Confirm' } }))

const realtime = vi.hoisted(() => ({ loaders: new WeakMap<object, unknown>() }))
vi.mock('#cwa/resources/realtime-view', () => ({
  realtimeView: ($cwa: object) => realtime.loaders.get($cwa) ?? { load: async () => undefined },
}))

const COMPONENT = '/component/html_contents/c1'

function peer(name: string | undefined, id: string, state: RealtimePeer['state'] = 'selected', isSelf = false): RealtimePeer {
  return { user: name ? { id, name } : { id }, name: isSelf ? 'You (other window)' : name ?? 'Someone', state, expiresAt: 0, colour: '#c084fc', isSelf, idle: state === 'idle' }
}

function cwaWith(peers: RealtimePeer[] | undefined) {
  const $cwa = {} as Cwa
  const view = peers ? { peers: vi.fn(() => peers) } : undefined
  realtime.loaders.set($cwa, { load: async () => view })
  return { $cwa, view }
}

describe('confirmResourceAction: the resource manager\'s prompts, in the kit confirm, loaded only when asked (#429, #461)', () => {
  test.each([
    { action: 'delete' as const, options: { title: 'Delete this resource?', description: 'This can\'t be undone.', keep: 'Don\'t delete', go: 'Delete' } },
    { action: 'discard' as const, options: { title: 'Discard this new component?', description: 'It hasn\'t been saved.', keep: 'Keep editing', go: 'Discard' } },
  ])('$action asks with the kit confirm and is confirmed unless cancelled', async ({ action, options }) => {
    reveal.mockResolvedValueOnce({ isCanceled: false, data: 'go' }).mockResolvedValueOnce({ isCanceled: true })
    const app = createApp({})

    expect(await confirmResourceAction(app, action)).toBe(true)
    expect(await confirmResourceAction(app, action)).toBe(false)
    expect(createConfirmDialog).toHaveBeenCalledWith({ name: 'Confirm' })
    expect(reveal).toHaveBeenCalledWith(options)
  })

  test('any other prompt is asked as given', async () => {
    reveal.mockResolvedValueOnce({ isCanceled: true })

    expect(await confirmResourceAction(createApp({}), { title: 't', description: 'c', go: 'Go' })).toBe(false)
    expect(reveal).toHaveBeenCalledWith({ title: 't', description: 'c', go: 'Go' })
  })

  test('a delete names who else is on the resource, as its first line', async () => {
    reveal.mockResolvedValueOnce({ isCanceled: false, data: 'go' })
    const app = createApp({})
    const { $cwa, view } = cwaWith([peer('Sam', '/users/sam', 'editing')])
    app.config.globalProperties.$cwa = $cwa

    await confirmResourceAction(app, 'delete', COMPONENT)

    expect(view!.peers).toHaveBeenCalledWith(COMPONENT)
    expect(reveal).toHaveBeenCalledWith({
      title: 'Delete this resource?',
      description: 'This can\'t be undone.',
      keep: 'Don\'t delete',
      go: 'Delete',
      lines: [{ text: 'Sam is editing this.' }],
    })
  })
})

describe('confirmChoice (#461)', () => {
  test.each([
    [{ isCanceled: false, data: 'extra' }, 'extra'],
    [{ isCanceled: false, data: 'go' }, 'go'],
    [{ isCanceled: false }, 'go'],
    [{ isCanceled: true }, undefined],
  ])('answers %o as %s', async (answer, choice) => {
    reveal.mockResolvedValueOnce(answer)

    expect(await confirmChoice(createApp({}), { title: 't', extra: 'Here', go: 'All' })).toBe(choice)
    expect(reveal).toHaveBeenCalledWith({ title: 't', extra: 'Here', go: 'All' })
  })
})

describe('editingNotice (#429)', () => {
  test.each([
    { peers: [peer('Sam', '/users/sam')], notice: 'Sam is editing this.' },
    { peers: [peer('Sam', '/users/sam'), peer('Sam', '/users/sam', 'editing')], notice: 'Sam is editing this.' },
    { peers: [peer('Sam', '/users/sam'), peer(undefined, '/users/anon')], notice: 'Sam and Someone are editing this.' },
    { peers: [peer('Sam', '/users/sam'), peer('Alex', '/users/alex'), peer('Jo', '/users/jo')], notice: 'Sam, Alex and Jo are editing this.' },
    { peers: [peer('Me', '/users/me', 'editing', true)], notice: 'You (other window) is editing this.' },
    { peers: [peer('Me', '/users/me', 'selected', true), peer('Sam', '/users/sam')], notice: 'You (other window) and Sam are editing this.' },
    { peers: [peer('Sam', '/users/sam', 'idle'), peer('Alex', '/users/alex')], notice: 'Alex is editing this.' },
    { peers: [peer('Sam', '/users/sam', 'idle')], notice: undefined },
    { peers: [], notice: undefined },
    { peers: undefined, notice: undefined },
  ])('$notice', async ({ peers, notice }) => {
    expect(await editingNotice(cwaWith(peers).$cwa, COMPONENT)).toBe(notice)
  })

  test('waits for the realtime view when nothing has loaded it yet', async () => {
    const $cwa = {} as Cwa
    const view = shallowRef<{ peers: () => RealtimePeer[] }>()
    realtime.loaders.set($cwa, {
      view,
      load: () => new Promise((resolve) => {
        setTimeout(() => resolve(view.value = { peers: () => [peer('Sam', '/users/sam')] }))
      }),
    })

    expect(await editingNotice($cwa, COMPONENT)).toBe('Sam is editing this.')
  })
})

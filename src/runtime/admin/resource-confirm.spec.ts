import { describe, expect, test, vi } from 'vitest'
import { createApp, shallowRef } from 'vue'
import { createConfirmDialog } from 'vuejs-confirm-dialog'
import { confirmResourceAction, editingNotice } from './resource-confirm'
import type { RealtimePeer } from './presence'
import type Cwa from '#cwa/cwa'

const reveal = vi.hoisted(() => vi.fn())
vi.mock('vuejs-confirm-dialog', () => ({
  install: vi.fn(),
  createConfirmDialog: vi.fn(() => ({ reveal })),
}))
vi.mock('#cwa/templates/components/core/ConfirmDialog.vue', () => ({ default: { name: 'ConfirmDialog' } }))

const realtime = vi.hoisted(() => ({ loaders: new WeakMap<object, unknown>() }))
vi.mock('#cwa/resources/realtime-view', () => ({
  realtimeView: ($cwa: object) => realtime.loaders.get($cwa) ?? { load: async () => undefined },
}))

const COMPONENT = '/component/html_contents/c1'

function peer(name: string | undefined, id: string, state: RealtimePeer['state'] = 'selected'): RealtimePeer {
  return { user: name ? { id, name } : { id }, state, expiresAt: 0 }
}

function cwaWith(peers: RealtimePeer[] | undefined) {
  const $cwa = {} as Cwa
  const view = peers ? { peers: vi.fn(() => peers) } : undefined
  realtime.loaders.set($cwa, { load: async () => view })
  return { $cwa, view }
}

describe('confirmResourceAction: the resource manager\'s prompts, loaded only when asked (#429)', () => {
  test.each([
    { action: 'delete' as const, title: 'Delete this resource?', content: '<p>Are you sure you want to permanently delete this resource?</p>' },
    { action: 'discard' as const, title: 'Discard new resource?', content: '<p>Are you sure you want to discard your new resource. It will NOT be saved.</p>' },
  ])('$action asks with ConfirmDialog and is confirmed unless cancelled', async ({ action, title, content }) => {
    reveal.mockResolvedValueOnce({ isCanceled: false }).mockResolvedValueOnce({ isCanceled: true })
    const app = createApp({})

    expect(await confirmResourceAction(app, action)).toBe(true)
    expect(await confirmResourceAction(app, action)).toBe(false)
    expect(createConfirmDialog).toHaveBeenCalledWith({ name: 'ConfirmDialog' })
    expect(reveal).toHaveBeenCalledWith({ title, content })
  })
  test('any other prompt is asked as given', async () => {
    reveal.mockResolvedValueOnce({ isCanceled: true })

    expect(await confirmResourceAction(createApp({}), { title: 't', content: 'c' })).toBe(false)
    expect(reveal).toHaveBeenCalledWith({ title: 't', content: 'c' })
  })

  test('a delete names who else is on the resource', async () => {
    reveal.mockResolvedValueOnce({ isCanceled: false })
    const app = createApp({})
    const { $cwa, view } = cwaWith([peer('Sam', '/users/sam', 'editing')])
    app.config.globalProperties.$cwa = $cwa

    await confirmResourceAction(app, 'delete', COMPONENT)

    expect(view!.peers).toHaveBeenCalledWith(COMPONENT)
    expect(reveal).toHaveBeenCalledWith({
      title: 'Delete this resource?',
      content: '<p>Are you sure you want to permanently delete this resource?</p>',
      notice: 'Sam is editing this.',
    })
  })
})

describe('editingNotice (#429)', () => {
  test.each([
    { peers: [peer('Sam', '/users/sam')], notice: 'Sam is editing this.' },
    { peers: [peer('Sam', '/users/sam'), peer('Sam', '/users/sam', 'editing')], notice: 'Sam is editing this.' },
    { peers: [peer('Sam', '/users/sam'), peer(undefined, '/users/anon')], notice: 'Sam and Someone are editing this.' },
    { peers: [peer('Sam', '/users/sam'), peer('Alex', '/users/alex'), peer('Jo', '/users/jo')], notice: 'Sam, Alex and Jo are editing this.' },
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

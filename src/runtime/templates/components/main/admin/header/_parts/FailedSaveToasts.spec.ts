// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, nextTick, reactive, ref } from 'vue'
import type { Ref } from 'vue'
import FailedSaveToasts from './FailedSaveToasts.vue'
import { trackFailedSave } from '#cwa/admin/field-states'
import type { FailedSave } from '#cwa/admin/field-states'
import { registerInstance, unregisterInstance } from '#cwa/admin/manageable-instances'
import type { CwaToastOptions } from '#cwa/composables/cwa-toast'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'

const fake = vi.hoisted(() => ({ $cwa: undefined as any, router: undefined as any }))
vi.mock('#build/cwa-config', () => ({ resourcesConfig: { HtmlContent: { name: 'Text' }, Image: { name: 'Picture' } } }))
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => fake.$cwa }))
vi.mock('#app/composables/router', () => ({ useRouter: () => fake.router }))

const toast = vi.hoisted(() => ({ show: vi.fn(), dismiss: vi.fn() }))
vi.mock('#cwa/composables/cwa-toast', () => ({ useCwaToast: () => toast }))

const DRAFT = '/component/html_contents/1-draft'
const LIVE = '/component/html_contents/1'
const OTHER = '/component/html_contents/2'

const open = new Map<string, CwaToastOptions>()
let store: { byId: Record<string, any>, publishable: Record<string, string[]> }
let currentIri: Ref<string | undefined>

function error(message = 'The server could not save it.'): CwaFieldState {
  return { status: 'error', waiting: false, slow: false, error: { kind: 'server', status: 500, message } }
}

function stored(iri: string, type = 'HtmlContent', fieldStates: Record<string, CwaFieldState> = {}) {
  store.byId[iri] = { data: { '@id': iri, '@type': type }, fieldStates }
}

function setState(iri: string, field: string, state: CwaFieldState | undefined) {
  const entry = store.byId[iri]
  const { [field]: _old, ...rest } = entry.fieldStates ?? {}
  entry.fieldStates = state ? { ...rest, [field]: state } : rest
}

function failed(iri: string, field: string, label = field): FailedSave {
  const save: FailedSave = { iri, field, label: () => label, retry: vi.fn(), reset: vi.fn() }
  trackFailedSave(fake.$cwa, save)
  return save
}

function close(id: string) {
  const options = open.get(id)
  open.delete(id)
  options?.onClose?.()
}

function act(id: string, label: string) {
  const options = open.get(id)
  options?.actions?.find(action => action.label === label)?.onClick()
  close(id)
}

function actionLabels(id: string) {
  return open.get(id)?.actions?.map(action => action.label)
}

const toastId = (iri: string) => `cwa-save-failed-${iri}`

beforeEach(() => {
  open.clear()
  toast.show.mockImplementation((options: CwaToastOptions) => open.set(options.id!, options))
  toast.dismiss.mockImplementation((id: string) => close(id))
  store = reactive({ byId: {}, publishable: { [DRAFT]: [LIVE, DRAFT], [LIVE]: [LIVE, DRAFT] } })
  currentIri = ref()
  const same = (a: string, b: string) => (store.publishable[a] ?? [a]).includes(b)
  fake.$cwa = {
    resources: {
      getResource: (iri: string) => computed(() => store.byId[iri]),
      findAllPublishableIris: (iri: string) => store.publishable[iri] ?? [iri],
      isIriPublishableEquivalent: same,
    },
    admin: {
      isEditing: true,
      toggleEdit: vi.fn((editing: boolean) => {
        fake.$cwa.admin.isEditing = editing
      }),
      eventBus: { emit: vi.fn() },
      resourceStackManager: { currentIri },
    },
  }
  fake.router = {
    currentRoute: ref({ fullPath: '/first-page' }),
    resolve: vi.fn((path: string) => ({ path: path.split('?')[0], query: {}, hash: '' })),
    push: vi.fn(),
  }
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('a field save that fails out of the bar\'s reach raises a toast (#461)', () => {
  test('a save that fails while its component is not selected raises one persistent error toast naming the component and the field', async () => {
    stored(LIVE, 'HtmlContent', { html: error() })
    mount(FailedSaveToasts)
    failed(LIVE, 'html', 'Body')
    await nextTick()

    expect(toast.show).toHaveBeenCalledOnce()
    expect(open.get(toastId(LIVE))).toMatchObject({
      tone: 'error',
      title: 'Text wasn\'t saved',
      description: 'Your last edit to Body wasn\'t saved.',
    })
    expect(actionLabels(toastId(LIVE))).toEqual(['Retry', 'Reset'])
  })

  test('no toast while the bar shows the resource, draft and published as one, and deselecting it raises one', async () => {
    stored(DRAFT, 'HtmlContent', { html: error() })
    stored(LIVE)
    currentIri.value = LIVE
    mount(FailedSaveToasts)
    failed(DRAFT, 'html', 'Body')
    await nextTick()

    expect(toast.show).not.toHaveBeenCalled()

    currentIri.value = undefined
    await nextTick()
    expect(open.has(toastId(DRAFT))).toBe(true)
  })

  test('selecting the resource while its toast is up closes it, because the bar now shows it', async () => {
    stored(LIVE, 'HtmlContent', { html: error() })
    mount(FailedSaveToasts)
    failed(LIVE, 'html', 'Body')
    await nextTick()
    expect(open.has(toastId(LIVE))).toBe(true)

    currentIri.value = DRAFT
    await nextTick()

    expect(toast.dismiss).toHaveBeenCalledWith(toastId(LIVE))
    expect(open.has(toastId(LIVE))).toBe(false)
    currentIri.value = OTHER
    await nextTick()
    expect(open.has(toastId(LIVE))).toBe(true)
  })

  test('several failed fields of one resource share one toast naming each label, and another resource has its own', async () => {
    stored(LIVE, 'HtmlContent', { html: error(), title: error(), summary: error() })
    stored(OTHER, 'Image', { alt: error() })
    mount(FailedSaveToasts)
    failed(LIVE, 'html', 'Body')
    failed(DRAFT, 'title', 'Title')
    failed(LIVE, 'summary', 'Summary')
    failed(OTHER, 'alt', 'Alt text')
    setState(LIVE, 'title', undefined)
    stored(DRAFT, 'HtmlContent', { title: error() })
    await nextTick()

    expect([...open.keys()]).toEqual([toastId(LIVE), toastId(OTHER)])
    expect(open.get(toastId(LIVE))?.description).toBe('Your last edit to Body, Title and Summary wasn\'t saved.')
    expect(open.get(toastId(OTHER))).toMatchObject({ title: 'Picture wasn\'t saved', description: 'Your last edit to Alt text wasn\'t saved.' })
  })

  test('a conflict is not an error, so it raises no toast', async () => {
    stored(LIVE, 'HtmlContent', { html: { status: 'conflict', waiting: false, slow: false, held: { value: 'Theirs' } } })
    mount(FailedSaveToasts)
    failed(LIVE, 'html', 'Body')
    await nextTick()

    expect(toast.show).not.toHaveBeenCalled()
  })

  test('the toast closes once the field leaves the error, and a later error on it raises nothing without a new failure', async () => {
    stored(LIVE, 'HtmlContent', { html: error() })
    mount(FailedSaveToasts)
    failed(LIVE, 'html', 'Body')
    await nextTick()

    setState(LIVE, 'html', { status: 'saved', waiting: false, slow: false, savedAt: 1 })
    await nextTick()
    expect(open.has(toastId(LIVE))).toBe(false)

    setState(LIVE, 'html', error())
    await nextTick()
    expect(open.has(toastId(LIVE))).toBe(false)
  })

  test('the toast stays while a retry is saving', async () => {
    stored(LIVE, 'HtmlContent', { html: error() })
    mount(FailedSaveToasts)
    failed(LIVE, 'html', 'Body')
    await nextTick()

    setState(LIVE, 'html', { status: 'saving', waiting: false, slow: false })
    await nextTick()
    setState(LIVE, 'html', error())
    await nextTick()

    expect(open.has(toastId(LIVE))).toBe(true)
  })

  test('Retry and Reset run on every failed field of the resource', async () => {
    stored(LIVE, 'HtmlContent', { html: error(), title: error() })
    mount(FailedSaveToasts)
    const body = failed(LIVE, 'html', 'Body')
    const title = failed(LIVE, 'title', 'Title')
    await nextTick()

    act(toastId(LIVE), 'Retry')
    expect(body.retry).toHaveBeenCalledOnce()
    expect(title.retry).toHaveBeenCalledOnce()
    expect(body.reset).not.toHaveBeenCalled()

    failed(LIVE, 'html', 'Body').reset = body.reset
    await nextTick()
    act(toastId(LIVE), 'Reset')
    expect(body.reset).toHaveBeenCalledOnce()
  })

  test('closing the toast forgets it, so nothing raises it again until the field fails again', async () => {
    stored(LIVE, 'HtmlContent', { html: error() })
    mount(FailedSaveToasts)
    failed(LIVE, 'html', 'Body')
    await nextTick()

    close(toastId(LIVE))
    close(toastId(LIVE))
    currentIri.value = OTHER
    await nextTick()
    expect(open.has(toastId(LIVE))).toBe(false)

    failed(LIVE, 'html', 'Body')
    await nextTick()
    expect(open.has(toastId(LIVE))).toBe(true)
  })

  test('Show me selects the resource on screen, in edit mode, and scrolls to it', async () => {
    stored(DRAFT, 'HtmlContent', { html: error() })
    const element = document.createElement('div')
    element.scrollIntoView = vi.fn()
    const elements = ref([element])
    registerInstance(fake.$cwa, LIVE, elements)
    fake.$cwa.admin.isEditing = false
    mount(FailedSaveToasts)
    failed(DRAFT, 'html', 'Body')
    await nextTick()

    expect(actionLabels(toastId(DRAFT))).toEqual(['Show me', 'Retry', 'Reset'])
    expect(open.get(toastId(DRAFT))?.actions?.[0]?.primary).toBe(true)
    act(toastId(DRAFT), 'Show me')

    expect(fake.$cwa.admin.toggleEdit).toHaveBeenCalledWith(true)
    expect(fake.$cwa.admin.eventBus.emit).toHaveBeenCalledWith('selectResource', LIVE)
    expect(element.scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
    expect(fake.router.push).not.toHaveBeenCalled()
    unregisterInstance(fake.$cwa, LIVE, elements)
  })

  test('Show me for a resource on another page goes back to the page it was selected on and selects it once it is on screen', async () => {
    stored(LIVE, 'HtmlContent', { html: error() })
    const wrapper = mount(FailedSaveToasts)
    fake.router.currentRoute.value = { fullPath: '/about?tab=1' }
    currentIri.value = LIVE
    await nextTick()
    fake.router.currentRoute.value = { fullPath: '/contact' }
    currentIri.value = undefined
    failed(LIVE, 'html', 'Body')
    await nextTick()
    fake.router.resolve.mockReturnValue({ path: '/about', query: { tab: '1' }, hash: '' })

    act(toastId(LIVE), 'Show me')

    expect(fake.router.resolve).toHaveBeenCalledWith('/about?tab=1')
    expect(fake.router.push).toHaveBeenCalledWith({ path: '/about', query: { tab: '1', cwa_force: 'true' }, hash: '' })
    expect(fake.$cwa.admin.eventBus.emit).not.toHaveBeenCalled()

    const elements = ref([document.createElement('div')])
    registerInstance(fake.$cwa, DRAFT, elements)
    await flushPromises()
    expect(fake.$cwa.admin.eventBus.emit).toHaveBeenCalledExactlyOnceWith('selectResource', DRAFT)
    unregisterInstance(fake.$cwa, DRAFT, elements)
    registerInstance(fake.$cwa, DRAFT, elements)
    await flushPromises()
    expect(fake.$cwa.admin.eventBus.emit).toHaveBeenCalledOnce()
    unregisterInstance(fake.$cwa, DRAFT, elements)
    wrapper.unmount()
  })

  test('Show me is left out when the resource is neither on screen nor on a page it was selected on', async () => {
    stored(LIVE, 'HtmlContent', { html: error() })
    mount(FailedSaveToasts)
    failed(LIVE, 'html', 'Body')
    await nextTick()

    expect(actionLabels(toastId(LIVE))).toEqual(['Retry', 'Reset'])

    const elements = ref([document.createElement('div')])
    registerInstance(fake.$cwa, LIVE, elements)
    await nextTick()
    expect(actionLabels(toastId(LIVE))).toEqual(['Show me', 'Retry', 'Reset'])
    unregisterInstance(fake.$cwa, LIVE, elements)
  })

  test('unmounting (signing out) closes its toasts', async () => {
    stored(LIVE, 'HtmlContent', { html: error() })
    const wrapper = mount(FailedSaveToasts)
    failed(LIVE, 'html', 'Body')
    await nextTick()

    wrapper.unmount()

    expect(open.size).toBe(0)
  })
})

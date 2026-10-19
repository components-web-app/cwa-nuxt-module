// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { AdminStore } from '../storage/stores/admin/admin-store'
import { useCloneMode } from './clone-mode'
import type Cwa from '#cwa/cwa'

const SOURCE_IRI = '/component/html_contents/source-uuid'

let pinia: Pinia
const started: ReturnType<typeof useCloneMode>[] = []

function buildCwa(storeName = 'cwa') {
  const adminStore = new AdminStore(storeName).useStore()
  adminStore.state.isEditing = true
  const auth = reactive<{ user: Record<string, any> | undefined }>({ user: { '@id': '/_/users/admin' } })
  const admin = {
    get isEditing() {
      return adminStore.state.isEditing
    },
    get navigationGuardDisabled() {
      return adminStore.state.navigationGuardDisabled
    },
    setNavigationGuardDisabled: vi.fn((disabled: boolean) => {
      adminStore.state.navigationGuardDisabled = disabled
    }),
    toggleEdit(editing?: boolean) {
      adminStore.state.isEditing = editing ?? !adminStore.state.isEditing
    },
  }
  const display = reactive<{ pageIri: string | undefined }>({ pageIri: '/_/pages/home' })
  const resources = {
    displayPageIri: computed(() => display.pageIri),
  }
  const $cwa = { admin, auth, resources } as unknown as Cwa
  return { $cwa, admin, auth, adminStore, display }
}

function cloneModeOf($cwa: Cwa) {
  const mode = useCloneMode($cwa)
  started.push(mode)
  return mode
}

async function nextTask() {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve))
}

function pressEscape(init: { prevent?: boolean } = {}) {
  const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
  if (init.prevent) {
    event.preventDefault()
  }
  window.dispatchEvent(event)
}

describe('clone mode', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    started.forEach(mode => mode.end())
    started.length = 0
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  test('start holds the source IRI and name on that Cwa instance only, never in the store', () => {
    const { $cwa } = buildCwa()
    const mode = cloneModeOf($cwa)
    mode.start(SOURCE_IRI, 'Hero text')
    expect(mode.source.value).toEqual({ iri: SOURCE_IRI, name: 'Hero text' })
    expect(useCloneMode($cwa).source.value).toEqual({ iri: SOURCE_IRI, name: 'Hero text' })
    expect(JSON.stringify(pinia.state.value)).not.toContain(SOURCE_IRI)
  })

  test('two Cwa instances hold separate clone sources', () => {
    const first = buildCwa('first')
    const second = buildCwa('second')
    cloneModeOf(first.$cwa).start(SOURCE_IRI, 'First')
    expect(useCloneMode(second.$cwa).source.value).toBeUndefined()
    cloneModeOf(second.$cwa).start('/component/other', 'Second')
    expect(useCloneMode(first.$cwa).source.value).toEqual({ iri: SOURCE_IRI, name: 'First' })
    expect(useCloneMode(second.$cwa).source.value).toEqual({ iri: '/component/other', name: 'Second' })
  })

  test('a second start replaces the source', () => {
    const { $cwa } = buildCwa()
    const mode = cloneModeOf($cwa)
    mode.start(SOURCE_IRI, 'First')
    mode.start('/component/other', 'Second')
    expect(mode.source.value).toEqual({ iri: '/component/other', name: 'Second' })
  })

  test('clone mode survives a route navigation', async () => {
    const { $cwa } = buildCwa()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { render: () => null } },
        { path: '/other', component: { render: () => null } },
      ],
    })
    await router.push('/')
    const mode = cloneModeOf($cwa)
    mode.start(SOURCE_IRI, 'Hero text')
    await router.push('/other')
    await nextTick()
    expect(router.currentRoute.value.path).toBe('/other')
    expect(useCloneMode($cwa).source.value).toEqual({ iri: SOURCE_IRI, name: 'Hero text' })
  })

  test('Escape ends clone mode', () => {
    const { $cwa } = buildCwa()
    const mode = cloneModeOf($cwa)
    mode.start(SOURCE_IRI)
    pressEscape()
    expect(mode.source.value).toBeUndefined()
  })

  test('a key other than Escape does not end clone mode', () => {
    const { $cwa } = buildCwa()
    const mode = cloneModeOf($cwa)
    mode.start(SOURCE_IRI)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(mode.source.value).toEqual({ iri: SOURCE_IRI, name: undefined })
  })

  test('Escape whose event was already handled by a dialog does not end clone mode', () => {
    const { $cwa } = buildCwa()
    const mode = cloneModeOf($cwa)
    mode.start(SOURCE_IRI)
    pressEscape({ prevent: true })
    expect(mode.source.value).toEqual({ iri: SOURCE_IRI, name: undefined })
  })

  test('Escape while a dialog is open closes only the dialog, not clone mode', () => {
    const { $cwa } = buildCwa()
    const mode = cloneModeOf($cwa)
    mode.start(SOURCE_IRI)
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)
    pressEscape()
    expect(mode.source.value).toEqual({ iri: SOURCE_IRI, name: undefined })
    dialog.remove()
    pressEscape()
    expect(mode.source.value).toBeUndefined()
  })

  test('Escape after clone mode has ended does nothing', () => {
    const { $cwa, admin } = buildCwa()
    const mode = cloneModeOf($cwa)
    mode.start(SOURCE_IRI)
    mode.end()
    admin.setNavigationGuardDisabled.mockClear()
    pressEscape()
    expect(admin.setNavigationGuardDisabled).not.toHaveBeenCalled()
  })

  test('leaving edit mode ends clone mode', async () => {
    const { $cwa, admin } = buildCwa()
    const mode = cloneModeOf($cwa)
    mode.start(SOURCE_IRI)
    admin.toggleEdit(false)
    await nextTick()
    expect(mode.source.value).toBeUndefined()
  })

  test('signing out ends clone mode', async () => {
    const { $cwa, auth } = buildCwa()
    const mode = cloneModeOf($cwa)
    mode.start(SOURCE_IRI)
    auth.user = undefined
    await nextTick()
    expect(mode.source.value).toBeUndefined()
  })

  test('starting clone mode turns navigation on so the editor can go to another page', () => {
    const { $cwa, adminStore } = buildCwa()
    cloneModeOf($cwa).start(SOURCE_IRI)
    expect(adminStore.state.navigationGuardDisabled).toBe(true)
  })

  test('a new page on screen turns navigation off so the next click places the clone', async () => {
    const { $cwa, adminStore, display } = buildCwa()
    cloneModeOf($cwa).start(SOURCE_IRI)
    display.pageIri = '/_/pages/second'
    await nextTask()
    expect(adminStore.state.navigationGuardDisabled).toBe(false)
    adminStore.state.navigationGuardDisabled = true
    await nextTick()
    display.pageIri = '/_/pages/third'
    await nextTask()
    expect(adminStore.state.navigationGuardDisabled).toBe(false)
  })

  test('navigation turns off only after the event that showed the new page, so the link click that navigated is not taken as a placement', async () => {
    const { $cwa, adminStore, display } = buildCwa()
    cloneModeOf($cwa).start(SOURCE_IRI)
    display.pageIri = '/_/pages/second'
    await nextTick()
    expect(adminStore.state.navigationGuardDisabled).toBe(true)
    await nextTask()
    expect(adminStore.state.navigationGuardDisabled).toBe(false)
  })

  test('clone mode ended before the new page settles leaves navigation as the end left it', async () => {
    const { $cwa, adminStore, display } = buildCwa()
    const mode = cloneModeOf($cwa)
    mode.start(SOURCE_IRI)
    display.pageIri = '/_/pages/second'
    await nextTick()
    mode.end()
    adminStore.state.navigationGuardDisabled = true
    await nextTask()
    expect(adminStore.state.navigationGuardDisabled).toBe(true)
  })

  test('the same page shown again, as when its fetch is revalidated, leaves navigation on', async () => {
    const { $cwa, adminStore, display } = buildCwa()
    cloneModeOf($cwa).start(SOURCE_IRI)
    display.pageIri = undefined
    await nextTick()
    display.pageIri = '/_/pages/home'
    await nextTask()
    expect(adminStore.state.navigationGuardDisabled).toBe(true)
  })

  test('navigation turned back on by the editor turns off on the next new page, not on the page it was turned on from', async () => {
    const { $cwa, adminStore, display } = buildCwa()
    cloneModeOf($cwa).start(SOURCE_IRI)
    display.pageIri = '/_/pages/second'
    await nextTask()
    adminStore.state.navigationGuardDisabled = true
    await nextTick()
    display.pageIri = undefined
    await nextTick()
    display.pageIri = '/_/pages/second'
    await nextTask()
    expect(adminStore.state.navigationGuardDisabled).toBe(true)
    display.pageIri = '/_/pages/third'
    await nextTask()
    expect(adminStore.state.navigationGuardDisabled).toBe(false)
  })

  test('no page on screen yet, as during a redirect, leaves navigation on', async () => {
    const { $cwa, adminStore, display } = buildCwa()
    cloneModeOf($cwa).start(SOURCE_IRI)
    display.pageIri = undefined
    await nextTask()
    expect(adminStore.state.navigationGuardDisabled).toBe(true)
  })

  test('after clone mode ends, a new page leaves navigation as the editor set it', async () => {
    const { $cwa, adminStore, display } = buildCwa()
    const mode = cloneModeOf($cwa)
    mode.start(SOURCE_IRI)
    mode.end()
    adminStore.state.navigationGuardDisabled = true
    display.pageIri = '/_/pages/second'
    await nextTask()
    expect(adminStore.state.navigationGuardDisabled).toBe(true)
  })

  test('ending clone mode turns navigation blocking back on', () => {
    const { $cwa, admin } = buildCwa()
    const mode = cloneModeOf($cwa)
    mode.start(SOURCE_IRI)
    admin.setNavigationGuardDisabled(true)
    mode.end()
    expect(admin.setNavigationGuardDisabled).toHaveBeenLastCalledWith(false)
    expect(admin.navigationGuardDisabled).toBe(false)
    expect(mode.source.value).toBeUndefined()
  })

  test('clone mode keeps watching edit mode after the component that started it unmounts', async () => {
    const { $cwa, admin } = buildCwa()
    const Starter = defineComponent({
      setup() {
        cloneModeOf($cwa).start(SOURCE_IRI)
        return () => h('div')
      },
    })
    const wrapper = mount(Starter)
    wrapper.unmount()
    expect(useCloneMode($cwa).source.value).toEqual({ iri: SOURCE_IRI, name: undefined })
    admin.toggleEdit(false)
    await nextTick()
    expect(useCloneMode($cwa).source.value).toBeUndefined()
  })
})

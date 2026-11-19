import { resourcesConfig } from '#build/cwa-config'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import { consola } from 'consola'
import throttle from 'lodash-es/throttle'
import type { DebouncedFunc } from 'lodash-es/debounce'
import {
  computed,
  Fragment,
  markRaw,
  nextTick,
  ref,
  watch,

} from 'vue'
import type { ComponentPublicInstance, Ref, WatchStopHandle, ComputedRef } from 'vue'
import type Cwa from '../cwa'
import { lazyImport } from '../lazy-import'
import ManagerTabsResolver from './manager-tabs-resolver'
import type { CwaCurrentResourceInterface } from '#cwa/storage/stores/resources/state'

const manageableInstances = lazyImport(() => import('./manageable-instances'))

const NATIVELY_FOCUSABLE = 'a[href], button, input, select, textarea, summary, [contenteditable]:not([contenteditable="false"])'

export type ManageableResourceOps = Ref<{
  disabled?: boolean
}>

export default class ManageableResource {
  private currentIri: Ref<string | undefined> | undefined
  private domElements: Ref<HTMLElement[]> = ref([])
  private unwatchCurrentIri: undefined | WatchStopHandle
  private tabResolver: ManagerTabsResolver
  private isIriInit: boolean = false
  private pendingChildMountedReInit: boolean = false
  private throttledRefreshFn: undefined | DebouncedFunc<() => void>
  private registeredIri: string | undefined
  private stopKeyboardAccess: undefined | WatchStopHandle
  private keyboardAccess = new Map<HTMLElement, string[]>()

  constructor(
    private readonly component: ComponentPublicInstance,
    private readonly $cwa: Cwa,
    private readonly ops: ManageableResourceOps,
    private readonly pageDepth: number = 0,
  ) {
    this.tabResolver = new ManagerTabsResolver()
    this.componentMountedListener = this.componentMountedListener.bind(this)
    this.selectResourceListener = this.selectResourceListener.bind(this)
    this.clickListener = this.clickListener.bind(this)
    this.keydownListener = this.keydownListener.bind(this)
  }

  // PUBLIC
  public init(iri: Ref<string | undefined>) {
    // because we need to be able to call this once resolving an IRI in some cases, if this is called again with a new
    // IRI, we should destroy what we need to for the old iri which is no longer relevant for this component instance
    this.clear(false)
    this.currentIri = iri
    this.$cwa.admin.eventBus.on('componentMounted', this.componentMountedListener)
    this.$cwa.admin.eventBus.on('selectResource', this.selectResourceListener)
    // we need to fire this right away to initialise the click handlers before the manageable resource emits a mounted event so this is the first click event rto fire imn the stack
    this.unwatchCurrentIri = watch(this.currentIri, this._initNewIri.bind(this), {
      immediate: true,
      flush: 'post',
    })
    this.stopKeyboardAccess = watch(
      () => [this.domElements.value, this.$cwa.admin.isEditing, this.ops.value.disabled, this.displayName] as const,
      ([elements, editing, disabled, name]) => this.applyKeyboardAccess(editing && disabled !== true && this.isComponent ? elements.filter(el => !el.matches?.(NATIVELY_FOCUSABLE)) : [], name),
      { immediate: true, flush: 'post' },
    )
  }

  private applyKeyboardAccess(elements: HTMLElement[], name: string | undefined) {
    const label = name ? `${name} component` : 'Component'
    for (const [el, added] of this.keyboardAccess) {
      if (!elements.includes(el) || (added.includes('aria-label') && el.getAttribute('aria-label') !== label)) {
        added.forEach(attribute => el.removeAttribute(attribute))
        this.keyboardAccess.delete(el)
      }
    }
    for (const el of elements) {
      if (this.keyboardAccess.has(el) || typeof el.setAttribute !== 'function') {
        continue
      }
      const values: Record<string, string> = { 'tabindex': '0', 'aria-label': label }
      if (['DIV', 'SPAN'].includes(el.tagName)) {
        values.role = 'group'
      }
      const added = Object.keys(values).filter(attribute => !el.hasAttribute(attribute))
      added.forEach(attribute => el.setAttribute(attribute, values[attribute]!))
      this.keyboardAccess.set(el, added)
    }
  }

  private _initNewIri(iri: string | undefined) {
    this.clear(true)
    this.isIriInit = true
    if (!iri) {
      return
    }
    this.addClickEventListeners()
  }

  public initNewIri() {
    this._initNewIri(this.currentIri?.value)
  }

  public get elements(): Ref<HTMLElement[]> {
    return this.domElements
  }

  public refreshElements() {
    if (!this.throttledRefreshFn) {
      this.throttledRefreshFn = throttle(this.doRefreshElements.bind(this), 40, {
        leading: true,
        trailing: true,
      })
    }
    this.throttledRefreshFn()
  }

  private doRefreshElements() {
    const currentIri = this.currentIri?.value
    if (!this.isIriInit || !currentIri) {
      return
    }
    const newElements = this.getAllEls()
    const existingElements = this.domElements.value
    if (newElements.length === existingElements.length && newElements.every((el, index) => el === existingElements[index])) {
      return
    }
    this.removeClickEventListeners()
    this.addClickEventListeners()
    this.$cwa.admin.eventBus.emit('componentMounted', currentIri)
  }

  public clear(soft: boolean = false) {
    this.throttledRefreshFn?.cancel()
    this.unregister()
    if (!this.isIriInit) {
      return
    }
    this.removeClickEventListeners()
    this.domElements.value = []

    if (!soft) {
      this.stopKeyboardAccess?.()
      this.stopKeyboardAccess = undefined
      this.applyKeyboardAccess([], undefined)
      this.$cwa.admin.eventBus.off('componentMounted', this.componentMountedListener)
      this.$cwa.admin.eventBus.off('selectResource', this.selectResourceListener)
      if (this.unwatchCurrentIri) {
        this.unwatchCurrentIri()
        this.unwatchCurrentIri = undefined
      }
      if (this.currentIri) {
        // must set to undefined and not just update the reactive variable as the reactive is probably a readonly prop
        this.currentIri = undefined
      }
    }

    this.isIriInit = false
  }

  // REFRESHING INITIALISATION
  private componentMountedListener(iri: string) {
    // to avoid firing the initialisation in the wrong order, where the component needs to be the first click event fired in the stack, we skip here and let the manageable composable call the initialisation of the click handler before emitting the componentMounted event
    const currentIri = this.currentIri?.value
    if (!currentIri || this.currentIri?.value === iri) {
      return
    }

    if (this.pendingChildMountedReInit) {
      return
    }

    const childIris = [...this.childIris.value]
    const renderedIri = this.$cwa.resources.positionComponentIri(currentIri, this.pageDepth).value
    if (renderedIri) {
      childIris.push(renderedIri)
    }
    const iris: string[] = []
    if (iri.endsWith('_placeholder')) {
      iris.push(iri)
      iris.push(...this.$cwa.resources.findAllPublishableIris(iri.replace('_placeholder', '')))
    }
    else {
      iris.push(...this.$cwa.resources.findAllPublishableIris(iri))
    }

    const isChild = iris.some(i => childIris.includes(i))

    if (isChild) {
      this.pendingChildMountedReInit = true
      this.$cwa.admin.eventBus.emit('componentMounted', currentIri)
      void nextTick(() => {
        this.pendingChildMountedReInit = false
        if (!this.currentIri?.value || !this.isIriInit) {
          return
        }
        this.removeClickEventListeners()
        this.addClickEventListeners()
      })
    }
  }

  public mockChildMounted() {
    const currentIri = this.currentIri?.value
    this.removeClickEventListeners()
    this.addClickEventListeners()
    if (currentIri) this.$cwa.admin.eventBus.emit('componentMounted', currentIri)
  }

  private selectResourceListener(iri: string) {
    if (iri === this.currentIri?.value) {
      this.triggerClick()
    }
  }

  private get childIris(): ComputedRef<string[]> {
    return computed(() => {
      if (!this.currentIri?.value) {
        return []
      }
      const addResourceEvent = this.$cwa.resourcesManager.addResourceEvent.value
      return this.$cwa.resources.getChildIris(this.currentIri?.value, addResourceEvent)
    })
  }

  // GET DOM ELEMENTS TO ADD CLICK EVENTS TO
  private getAllEls(): any[] {
    const allSiblings: any[] = []
    const subTree = this.component.$?.subTree
    let currentEl: any = subTree?.type === Fragment ? subTree.el : this.component.$el
    if (!currentEl) {
      return []
    }

    if (currentEl.nodeType === Node.ELEMENT_NODE) {
      return [currentEl]
    }

    let startTagCount = 0

    do {
      if (currentEl.nodeType === Node.COMMENT_NODE) {
        const nodeValue = currentEl.nodeValue.trim()
        if (startTagCount && nodeValue === 'cwa-end') {
          startTagCount--
          if (startTagCount === 0) {
            break
          }
        }
        if (nodeValue === 'cwa-start') {
          startTagCount++
        }
        continue
      }
      currentEl.nodeType === Node.ELEMENT_NODE && startTagCount && allSiblings.push(currentEl)
    } while ((currentEl = currentEl.nextSibling))

    return allSiblings
  }

  private unregister() {
    if (this.registeredIri === undefined) {
      return
    }
    manageableInstances.loaded?.unregisterInstance(this.$cwa, this.registeredIri, this.domElements)
    this.registeredIri = undefined
  }

  private register() {
    const iri = this.currentIri?.value
    this.unregister()
    if (!iri) {
      return
    }
    this.registeredIri = iri
    const loaded = manageableInstances.loaded
    if (loaded) {
      loaded.registerInstance(this.$cwa, iri, this.domElements)
      return
    }
    void manageableInstances.load().then((module) => {
      if (this.registeredIri === iri) {
        module.registerInstance(this.$cwa, iri, this.domElements)
      }
    })
  }

  private addClickEventListeners() {
    this.domElements.value = this.getAllEls()
    this.register()
    for (const el of this.domElements.value) {
      el.addEventListener('click', this.clickListener, false)
      el.addEventListener('contextmenu', this.clickListener, false)
      el.addEventListener('keydown', this.keydownListener, false)
    }
  }

  private async triggerClick() {
    await new Promise<void>((resolve) => {
      if (this.domElements.value.length) {
        resolve()
        return
      }
      function finish() {
        stopWatch()
        clearTimeout(timeout)
        resolve()
      }
      const stopWatch = watch(this.domElements, (newDomEls) => {
        newDomEls.length && finish()
      })
      const timeout = setTimeout(finish, 1000)
    })
    const firstDomElement = this.domElements.value[0]
    if (!firstDomElement) {
      consola.error('Manageable resource listener called to select component, but no dom elements found.', this.currentIri?.value)
      return
    }
    const clickEvent = new Event('click', { bubbles: true })
    this.$cwa.admin.resourceStackManager.selectFromModule(() => firstDomElement.dispatchEvent(clickEvent))
  }

  private removeClickEventListeners() {
    for (const el of this.domElements.value) {
      el.removeEventListener('click', this.clickListener)
      el.removeEventListener('contextmenu', this.clickListener)
      el.removeEventListener('keydown', this.keydownListener)
    }
  }

  // This will be called by the click event listener in context of this, and can be removed as well.
  // if we define with a name and call that, the `this` context will be the clicked dom element
  private clickListener(evt: MouseEvent) {
    if (!this.currentIri?.value || !this.currentResource || this.ops.value.disabled === true) {
      return
    }

    this.$cwa.admin.resourceStackManager.addToStack(this.getCurrentStackItem(evt.target), evt.type === 'contextmenu', this.ops)
  }

  private keydownListener(evt: KeyboardEvent) {
    const el = evt.currentTarget as HTMLElement
    if (evt.target !== el || !this.keyboardAccess.has(el) || evt.defaultPrevented || evt.altKey || evt.metaKey || evt.ctrlKey || evt.isComposing) {
      return
    }
    const opensStack = evt.key === 'ContextMenu' || (evt.key === 'F10' && evt.shiftKey)
    if (opensStack) {
      evt.preventDefault()
      const box = el.getBoundingClientRect()
      const clientX = Math.max(0, Math.min(box.left + Math.min(16, box.width / 2), window.innerWidth - 1))
      const clientY = Math.max(0, Math.min(box.top + Math.min(16, box.height / 2), window.innerHeight - 1))
      el.dispatchEvent(new MouseEvent('contextmenu', { clientX, clientY, button: 2, bubbles: true, cancelable: true }))
      return
    }
    if (evt.shiftKey || (evt.key !== 'Enter' && evt.key !== ' ')) {
      return
    }
    evt.preventDefault()
    this.$cwa.admin.resourceStackManager.selectFromModule(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
  }

  private getCurrentStackItem(clickTarget: EventTarget | null) {
    if (!this.currentResource || !this.currentIri?.value) {
      throw new Error('Cannot get a currentStackItem when currentResource or currentIri is not defined')
    }
    return {
      iri: this.currentIri.value,
      domElements: this.domElements,
      clickTarget,
      displayName: this.displayName,
      managerTabs: markRaw(this.tabResolver.resolve({
        resourceType: getResourceTypeFromIri(this.currentIri.value) ?? (this.currentIri.value === NEW_RESOURCE_IRI ? CwaResourceTypes.COMPONENT : undefined),
        resourceConfig: this.resourceConfig,
        resource: this.currentResource,
      })),
      ui: this.resourceConfig?.ui,
      childIris: this.childIris,
    }
  }

  private get isComponent() {
    const iri = this.currentIri?.value
    return !!iri && (iri === NEW_RESOURCE_IRI || getResourceTypeFromIri(iri) === CwaResourceTypes.COMPONENT)
  }

  private get currentResource() {
    return this.currentIri?.value ? this.$cwa.resources.getResource(this.currentIri.value)?.value : undefined
  }

  private get resourceType() {
    const currentResource: CwaCurrentResourceInterface | undefined = this.currentResource
    if (!currentResource) {
      return
    }
    return currentResource.data?.['@type']
  }

  private get resourceConfig() {
    const currentResource: CwaCurrentResourceInterface | undefined = this.currentResource
    if (!currentResource) {
      return
    }
    if (!this.resourceType) {
      return
    }
    return resourcesConfig[this.resourceType]
  }

  private get displayName() {
    return this.resourceConfig?.name || this.resourceType
  }
}

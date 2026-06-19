import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import { watchOnce } from '@vueuse/core'
import { consola } from 'consola'
import {
  computed,
  markRaw,
  nextTick,
  ref,
  watch,

} from 'vue'
import type { ComponentPublicInstance, Ref, WatchStopHandle, ComputedRef } from 'vue'
import type Cwa from '../cwa'
import ManagerTabsResolver from './manager-tabs-resolver'
import type { CwaCurrentResourceInterface } from '#cwa/storage/stores/resources/state'

export type StyleOptions = {
  multiple?: boolean
  classes: { [name: string]: string[] }
}

export type ManageableResourceOps = Ref<{
  styles?: StyleOptions
  disabled?: boolean
}>

export default class ManageableResource {
  private currentIri: Ref<string | undefined> | undefined
  private domElements: Ref<HTMLElement[]> = ref([])
  private unwatchCurrentIri: undefined | WatchStopHandle
  private tabResolver: ManagerTabsResolver
  private isIriInit: boolean = false
  private pendingChildMountedReInit: boolean = false

  constructor(
    private readonly component: ComponentPublicInstance,
    private readonly $cwa: Cwa,
    private readonly ops: ManageableResourceOps,
  ) {
    this.tabResolver = new ManagerTabsResolver()
    this.componentMountedListener = this.componentMountedListener.bind(this)
    this.selectResourceListener = this.selectResourceListener.bind(this)
    this.clickListener = this.clickListener.bind(this)
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

  public clear(soft: boolean = false) {
    if (!this.isIriInit) {
      return
    }
    this.removeClickEventListeners()
    this.domElements.value = []

    if (!soft) {
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

    // Already scheduled a re-init this tick: emit the cascade immediately (so grandparents still
    // propagate in the same synchronous pass) but skip redundant addClickEventListeners work.
    if (this.pendingChildMountedReInit) {
      return
    }

    const childIris = this.childIris.value
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
      // Emit the cascade synchronously so grandparents propagate in the same pass, but defer the
      // actual DOM listener refresh to nextTick. This ensures children register their own click
      // listeners (via the post-flush watcher) before parents register theirs, which fixes the
      // click-event ordering bug that caused the resource stack to compound across clicks.
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
    let currentEl: any = this.component.$el
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

  private addClickEventListeners() {
    this.domElements.value = this.getAllEls()
    for (const el of this.domElements.value) {
      el.addEventListener('click', this.clickListener, false)
      el.addEventListener('contextmenu', this.clickListener, false)
    }
  }

  private async triggerClick() {
    await new Promise<void>((resolve) => {
      if (this.domElements.value.length) {
        resolve()
        return
      }
      const timeout = setTimeout(() => {
        stopWatch()
        clearTimeout(timeout)
      }, 1000)
      const stopWatch = watchOnce(this.domElements, (newDomEls) => {
        if (newDomEls.length) {
          resolve()
          clearTimeout(timeout)
        }
      })
    })
    const firstDomElement = this.domElements.value[0]
    if (!firstDomElement) {
      consola.error('Manageable resource listener called to select component, but no dom elements found.', this.currentIri?.value)
      return
    }
    const clickEvent = new Event('click', { bubbles: true })
    firstDomElement.dispatchEvent(clickEvent)
  }

  private removeClickEventListeners() {
    for (const el of this.domElements.value) {
      el.removeEventListener('click', this.clickListener)
      el.removeEventListener('contextmenu', this.clickListener)
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

  private getCurrentStackItem(clickTarget: EventTarget | null) {
    if (!this.currentResource || !this.currentIri?.value) {
      throw new Error('Cannot get a currentStackItem when currentResource or currentIri is not defined')
    }
    // domElements is passed as the live this.domElements ref (not a snapshot) so that
    // ComponentFocus can react to DOM changes while the resource is selected — for example
    // when the user switches a UI variant and new elements mount in place of the old ones.
    //
    // CONSUMER NOTE — do NOT use :static="someStackCheck" on Headless UI containers
    // (menus, disclosures, etc.) to keep them open while their children are being selected.
    // resourceStack returns [] while a click is being processed, causing isEditing to flicker
    // false for one flush cycle, which makes the container unmount and clears domElements
    // before ComponentFocus can read them.
    //
    // The correct approach: let Headless UI control open/close naturally. When the container
    // is open and the user clicks a child component, ManageableResource captures the click
    // before any close() handler fires. No static prop is needed.
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
      styles: computed(() => this.ops.value.styles),
      childIris: this.childIris,
    }
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
    if (!this.$cwa.resourcesConfig || !this.resourceType) {
      return
    }
    return this.$cwa.resourcesConfig[this.resourceType]
  }

  private get displayName() {
    return this.resourceConfig?.name || this.resourceType
  }
}

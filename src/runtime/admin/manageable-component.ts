import {
  computed,
  markRaw, nextTick,
  ref,
  watch
} from 'vue'
import type {
  ComponentPublicInstance,
  ComputedRef,
  Ref,
  WatchStopHandle
} from 'vue'
import {
  CwaResourceTypes,
  getResourceTypeFromIri,
  resourceTypeToNestedResourceProperties
} from '../resources/resource-utils'
import Cwa from '../cwa'
// todo: error GET https://localhost:3000/_nuxt/@fs/[PATH]/cwa-nuxt-3-module/src/runtime/admin/manager-tabs-resolver.ts net::ERR_TOO_MANY_RETRIES - appears chromium bug with self-signed cert
import ManagerTabsResolver from './manager-tabs-resolver'
import type { ResourceStackItem } from '#cwa/runtime/admin/component-manager'
import type { CwaCurrentResourceInterface } from '#cwa/runtime/storage/stores/resources/state'

export type StyleOptions = {
  multiple?: boolean,
  classes: { [name: string]: string[] }
}

export type ManageableComponentOps = {
  styles?: StyleOptions
  disabled?: boolean
}

export default class ManageableComponent {
  private currentIri: Ref<string|undefined>|undefined
  private domElements: Ref<HTMLElement[]> = ref([])
  private unwatchCurrentStackItem: undefined|WatchStopHandle
  private unwatchCurrentIri: undefined|WatchStopHandle
  private readonly yOffset = 100
  private tabResolver: ManagerTabsResolver
  private isInit: boolean = false

  constructor (
    private readonly component: ComponentPublicInstance,
    private readonly $cwa: Cwa,
    private readonly ops: ManageableComponentOps
  ) {
    this.tabResolver = new ManagerTabsResolver()
    this.componentMountedListener = this.componentMountedListener.bind(this)
    this.clickListener = this.clickListener.bind(this)
    watch(ops, (newOps, oldOps) => {
      if (newOps.disabled && !oldOps.disabled) {
        this.clear(false)
        return
      }
      if (!newOps.disabled && oldOps.disabled && this.currentIri) {
        this.init(this.currentIri)
      }
    })
  }

  // PUBLIC
  public init (iri: Ref<string|undefined>) {
    // because we need to be able to call this once resolving an IRI in some cases, if this is called again with a new
    // IRI, we should destroy what we need to for the old iri which is no longer relevant for this component instance
    this.clear(false)
    this.currentIri = iri
    this.$cwa.admin.eventBus.on('componentMounted', this.componentMountedListener)
    this.unwatchCurrentIri = watch(this.currentIri, this.iriWatchHandler.bind(this), {
      immediate: true,
      flush: 'post'
    })
  }

  private iriWatchHandler (newIri: string|undefined) {
    this.clear(true)
    if (!newIri) {
      return
    }
    this.isInit = true
    this.addClickEventListeners()
    this.unwatchCurrentStackItem = watch(this.$cwa.admin.componentManager.currentStackItem, this.currentStackItemListener.bind(this), {
      flush: 'post'
    })
  }

  public clear (soft: boolean = false) {
    if (!this.isInit) {
      return
    }
    this.removeClickEventListeners()
    this.domElements.value = []
    if (this.unwatchCurrentStackItem) {
      this.unwatchCurrentStackItem()
      this.unwatchCurrentStackItem = undefined
    }
    if (!soft) {
      this.$cwa.admin.eventBus.off('componentMounted', this.componentMountedListener)
      if (this.unwatchCurrentIri) {
        this.unwatchCurrentIri()
        this.unwatchCurrentIri = undefined
      }
      if (this.currentIri) {
        // must set to undefined and not just update the reactive variable as the reactive is probably a readonly prop
        this.currentIri = undefined
      }
    }
    this.isInit = false
  }

  // REFRESHING INITIALISATION
  private componentMountedListener (iri: string) {
    if (iri === this.currentIri?.value) {
      this.iriWatchHandler(iri)
    }
    const iriIsChild = () => {
      const iris = [this.$cwa.resources.findPublishedComponentIri(iri), this.$cwa.resources.findDraftComponentIri(iri)].filter(i => !!i.value)
      for (const iri of iris) {
        if (this.childIris.value.includes(iri.value)) {
          return true
        }
      }
      return false
    }

    if (iriIsChild()) {
      this.removeClickEventListeners()
      this.addClickEventListeners()
    }
  }

  private async currentStackItemListener (stackItem: ResourceStackItem|undefined) {
    if (!this.currentIri?.value) {
      return
    }
    if (!stackItem || stackItem.iri !== this.currentIri.value) {
      return
    }

    // when changing UI component, next tick seems necessary for allowing dom to update first.
    // e.g. click off a live component, it switched back to a draft, could be taller, need to scroll into view
    await nextTick()
    this.scrollIntoView()
  }

  // external api to manually trigger window size update
  // public updateFocusSize () {
  //   if (!this.focusComponent) {
  //     return
  //   }
  //   this.focusComponent._container._vnode.component.exposed.updateWindowSize()
  // }

  private scrollIntoView () {
    let element: undefined|HTMLElement
    let elementOutOfView = false

    for (const elCandidate of this.domElements.value) {
      if (elCandidate.nodeType === Node.ELEMENT_NODE) {
        if (!element) {
          element = elCandidate
        }

        if (this.isElementOutsideViewport(element)) {
          elementOutOfView = true
        }
        if (elementOutOfView && element) {
          break
        }
      }
    }

    if (!element || !elementOutOfView) {
      return
    }
    const y = element.getBoundingClientRect().top + window.scrollY - this.yOffset
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  private isElementOutsideViewport (el: HTMLElement) {
    const { top, left, bottom, right } = el.getBoundingClientRect()
    const { innerHeight, innerWidth } = window
    return top < this.yOffset || left < 0 || bottom > innerHeight || right > innerWidth
  }

  // COMPUTED FOR REFRESHING
  private get childIris (): ComputedRef<string[]> {
    return computed(() => {
      if (!this.currentIri?.value) {
        return []
      }
      const getChildren = (iri: string): string[] => {
        const nested = []
        const resource = this.$cwa.resources.getResource(iri)
        const type = getResourceTypeFromIri(iri)
        if (!type) {
          return []
        }
        // we don't have a real IRI for a placeholder - placeholders only currently used for positions
        // todo: test
        if (type === CwaResourceTypes.COMPONENT_POSITION) {
          nested.push(`${iri}_placeholder`)
        }
        const properties = resourceTypeToNestedResourceProperties[type]

        for (const prop of properties) {
          const children = resource.value.data?.[prop]
          if (!children || !Array.isArray(children)) {
            children && nested.push(children)
            continue
          }
          for (const child of children) {
            nested.push(child)
            nested.push(...getChildren(child))
          }
        }

        return nested
      }

      return getChildren(this.currentIri.value)
    })
  }

  // GET DOM ELEMENTS TO ADD CLICK EVENTS TO
  private getAllEls (): any[] {
    const allSiblings: any[] = []
    let currentEl: any = this.component.$el
    if (!currentEl) {
      return []
    }

    if (currentEl.nodeType === Node.ELEMENT_NODE) {
      return [currentEl]
    }

    let endCommentTag: undefined|string

    do {
      if (!endCommentTag && currentEl.nodeType === Node.COMMENT_NODE && currentEl.nodeValue.startsWith('CWA_MANAGER_START_')) {
        const startTag = currentEl.nodeValue
        const startTagPostfix = startTag.replace(/^(CWA_MANAGER_START_)/, '')
        endCommentTag = `CWA_MANAGER_END_${startTagPostfix}`
      }
      if (endCommentTag && currentEl.nodeType === Node.COMMENT_NODE && currentEl.nodeValue === endCommentTag) {
        break
      }
      currentEl.nodeType !== Node.TEXT_NODE && allSiblings.push(currentEl)
    } while ((currentEl = currentEl.nextSibling))

    return allSiblings
  }

  private addClickEventListeners () {
    this.domElements.value = this.getAllEls()
    for (const el of this.domElements.value) {
      el.addEventListener('click', this.clickListener, false)
      el.addEventListener('contextmenu', this.clickListener, false)
    }
  }

  private removeClickEventListeners () {
    for (const el of this.domElements.value) {
      el.removeEventListener('click', this.clickListener)
      el.removeEventListener('contextmenu', this.clickListener)
    }
  }

  // This will be called by the click event listener in context of this, and can be removed as well.
  // if we define with a name and call that, the `this` context will be the clicked dom element
  private clickListener (evt: MouseEvent) {
    if (!this.currentIri?.value || !this.currentResource) {
      return
    }

    this.$cwa.admin.componentManager.addToStack(this.getCurrentStackItem(evt.target), evt.type === 'contextmenu')
  }

  private getCurrentStackItem (clickTarget: EventTarget|null) {
    if (!this.currentResource || !this.currentIri?.value) {
      throw new Error('Cannot get a currentStackItem when currentResource or currentIri is not defined')
    }
    return {
      iri: this.currentIri.value,
      domElements: this.domElements,
      clickTarget,
      displayName: this.displayName,
      managerTabs: markRaw(this.tabResolver.resolve({ resourceType: this.resourceType, resourceConfig: this.resourceConfig, resource: this.currentResource })),
      ui: this.resourceConfig?.ui,
      styles: computed(() => this.ops.styles),
      childIris: this.childIris
    }
  }

  private get currentResource () {
    return this.currentIri?.value ? this.$cwa.resources.getResource(this.currentIri.value)?.value : undefined
  }

  private get resourceType () {
    const currentResource: CwaCurrentResourceInterface|undefined = this.currentResource
    if (!currentResource) {
      return
    }
    return currentResource.data?.['@type']
  }

  private get resourceConfig () {
    const currentResource: CwaCurrentResourceInterface|undefined = this.currentResource
    if (!currentResource) {
      return
    }
    if (!this.$cwa.resourcesConfig || !this.resourceType) {
      return
    }
    return this.$cwa.resourcesConfig[this.resourceType]
  }

  private get displayName () {
    return this.resourceConfig?.name || this.resourceType
  }
}

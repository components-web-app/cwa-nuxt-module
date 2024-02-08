import {
  computed,
  markRaw,
  ref,
  watch
} from 'vue'
import type {
  ComponentPublicInstance,
  ComputedRef,
  Ref,
  WatchStopHandle
} from 'vue'
import { consola } from 'consola'
import {
  CwaResourceTypes,
  getResourceTypeFromIri,
  resourceTypeToNestedResourceProperties
} from '../resources/resource-utils'
import Cwa from '../cwa'
// if you get error GET https://localhost:3000/_nuxt/@fs/[PATH]/cwa-nuxt-3-module/src/runtime/admin/manager-tabs-resolver.ts net::ERR_TOO_MANY_RETRIES
// appears chromium bug with self-signed cert
import ManagerTabsResolver from './manager-tabs-resolver'
import type { CwaCurrentResourceInterface } from '#cwa/runtime/storage/stores/resources/state'
import { NEW_RESOURCE_IRI } from '#cwa/runtime/storage/stores/resources/state'

export type StyleOptions = {
  multiple?: boolean,
  classes: { [name: string]: string[] }
}

export type ManageableResourceOps = Ref<{
  styles?: StyleOptions
  disabled?: boolean
}>

export default class ManageableResource {
  private currentIri: Ref<string|undefined>|undefined
  private domElements: Ref<HTMLElement[]> = ref([])
  private unwatchCurrentIri: undefined|WatchStopHandle
  private tabResolver: ManagerTabsResolver
  private isIriInit: boolean = false

  constructor (
    private readonly component: ComponentPublicInstance,
    private readonly $cwa: Cwa,
    private readonly ops: ManageableResourceOps
  ) {
    this.tabResolver = new ManagerTabsResolver()
    this.componentMountedListener = this.componentMountedListener.bind(this)
    this.selectResourceListener = this.selectResourceListener.bind(this)
    this.clickListener = this.clickListener.bind(this)
  }

  // PUBLIC
  public init (iri: Ref<string|undefined>) {
    // because we need to be able to call this once resolving an IRI in some cases, if this is called again with a new
    // IRI, we should destroy what we need to for the old iri which is no longer relevant for this component instance
    this.clear(false)
    this.currentIri = iri
    this.$cwa.admin.eventBus.on('componentMounted', this.componentMountedListener)
    this.$cwa.admin.eventBus.on('selectResource', this.selectResourceListener)
    this.unwatchCurrentIri = watch(this.currentIri, this.initNewIri.bind(this), {
      immediate: true,
      flush: 'post'
    })
  }

  private initNewIri (iri: string|undefined) {
    this.clear(true)
    if (!iri) {
      return
    }
    this.isIriInit = true
    this.addClickEventListeners()
  }

  public clear (soft: boolean = false) {
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

      // todo: remove from current stack is was already added and now is disabled
    }
    this.isIriInit = false
  }

  // REFRESHING INITIALISATION
  private componentMountedListener (iri: string) {
    // todo: detect if mounted component is a new component within children...
    if (iri === this.currentIri?.value) {
      this.initNewIri(iri)
    }
    const iris = this.$cwa.resources.findAllPublishableIris(iri)
    const iriIsChild = () => {
      for (const iri of iris) {
        if (this.childIris.value.includes(iri)) {
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

  private selectResourceListener (iri: string) {
    if (iri === this.currentIri?.value) {
      this.triggerClick()
    }
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
        if (!resource.value) {
          consola.warn(`Could not get children for '${iri}' - Resource not found`)
          return []
        }
        if (!type) {
          return []
        }
        // we don't have a real IRI for a placeholder - placeholders only currently used for positions
        // todo: test
        if (type === CwaResourceTypes.COMPONENT_POSITION || type === CwaResourceTypes.COMPONENT_GROUP) {
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
    // Once click event listeners are added, if this is a new resource, select it
    if (this.domElements.value.length && this.currentIri?.value === NEW_RESOURCE_IRI) {
      this.triggerClick()
    }
  }

  private triggerClick () {
    const firstDomElement = this.domElements.value[0]
    const clickEvent = new Event('click', { bubbles: true })
    firstDomElement.dispatchEvent(clickEvent)
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
    if (!this.currentIri?.value || !this.currentResource || this.ops.value.disabled === true) {
      return
    }

    this.$cwa.admin.resourceStackManager.addToStack(this.getCurrentStackItem(evt.target), evt.type === 'contextmenu', this.ops)
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
      styles: computed(() => this.ops.value.styles),
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

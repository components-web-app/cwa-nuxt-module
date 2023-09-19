import {
  App,
  ComponentPublicInstance,
  computed,
  ComputedRef,
  ref,
  Ref,
  watch,
  WatchStopHandle,
  createApp
} from 'vue'
import { getResourceTypeFromIri, resourceTypeToNestedResourceProperties } from '../resources/resource-utils'
import Cwa from '../cwa'
import { ResourceStackItem } from '#cwa/runtime/admin/component-manager'
import ComponentFocus from '#cwa/layer/_components/admin/component-focus.vue'
import { CwaCurrentResourceInterface } from '#cwa/runtime/storage/stores/resources/state'

export interface ManageableComponentOptions {
  displayName?: string
}

export default class ManageableComponent {
  private currentIri: string|undefined
  private domElements: Ref<HTMLElement[]> = ref([])
  private unwatchCurrentStackItem: undefined|WatchStopHandle
  private focusComponent: undefined|App
  private focusWrapper: HTMLElement|undefined
  private readonly yOffset = 100

  constructor (
    private readonly component: ComponentPublicInstance,
    private readonly $cwa: Cwa,
    private readonly options?: ManageableComponentOptions) {
    this.componentMountedListener = this.componentMountedListener.bind(this)
    this.clickListener = this.clickListener.bind(this)
  }

  // PUBLIC
  public init (iri: string) {
    // because we need to be able to call this once resolving an IRI in some cases, if this is called again with a new
    // IRI, we should destroy what we need to for the old iri which is no longer relevant for this component instance
    if (this.currentIri) {
      this.clear()
    }

    this.currentIri = iri
    this.addClickEventListeners()
    this.$cwa.admin.eventBus.on('componentMounted', this.componentMountedListener)
    this.unwatchCurrentStackItem = watch(this.$cwa.admin.componentManager.currentStackItem, this.currentStackItemListener.bind(this))
    this.$cwa.admin.eventBus.emit('componentMounted', iri)
  }

  public clear () {
    if (!this.currentIri) {
      return
    }
    this.$cwa.admin.eventBus.off('componentMounted', this.componentMountedListener)
    this.removeClickEventListeners()
    this.currentIri = undefined
    this.domElements.value = []
    if (this.unwatchCurrentStackItem) {
      this.unwatchCurrentStackItem()
      this.unwatchCurrentStackItem = undefined
    }
  }

  // REFRESHING INITIALISATION
  private componentMountedListener (iri: string) {
    if (this.childIris.value.includes(iri)) {
      this.removeClickEventListeners()
      this.addClickEventListeners()
    }
  }

  private currentStackItemListener (stackItem: ResourceStackItem|null) {
    if (stackItem?.iri !== this.currentIri) {
      if (this.focusComponent) {
        this.focusComponent.unmount()
        this.focusComponent = undefined
      }
      if (this.focusWrapper) {
        this.focusWrapper.remove()
        this.focusWrapper = undefined
      }
      return
    }
    if (!stackItem) {
      return
    }

    this.focusComponent = createApp(ComponentFocus, {
      iri: this.currentIri,
      domElements: computed(() => stackItem.domElements)
    })
    this.focusWrapper = document.createElement('div')
    this.focusComponent.mount(this.focusWrapper)
    document.body.appendChild(this.focusWrapper)

    this.scrollIntoView()
  }

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
      if (!this.currentIri) {
        return []
      }
      const getChildren = (iri: string): string[] => {
        const nested = []
        const resource = this.$cwa.resources.getResource(iri)
        const type = getResourceTypeFromIri(iri)
        if (!type) {
          return []
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

      return getChildren(this.currentIri)
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
    if (!this.currentIri) {
      return
    }

    this.$cwa.admin.componentManager.addToStack({
      iri: this.currentIri,
      domElements: this.domElements,
      clickTarget: evt.target,
      displayName: this.displayName
    })
  }

  private get displayName () {
    const localDisplayName = this.options?.displayName
    if (localDisplayName) {
      return localDisplayName
    }
    const currentResource: CwaCurrentResourceInterface|undefined = this.currentIri ? this.$cwa.resources.getResource(this.currentIri)?.value : undefined
    if (!currentResource) {
      return null
    }
    const type = currentResource.data?.['@type']
    if (!type) {
      return null
    }
    return this.$cwa.resourcesConfig[type]?.name || type
  }
}

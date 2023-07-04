import { ComponentPublicInstance, computed, ComputedRef } from 'vue'
import { getResourceTypeFromIri, resourceTypeToNestedResourceProperties } from '../resources/resource-utils'
import Cwa from '../cwa'

export default class ManageableComponent {
  private currentIri: string|undefined
  private domElements: any[] = []

  constructor (private component: ComponentPublicInstance, private $cwa: Cwa) {
    this.componentMountedListener = this.componentMountedListener.bind(this)
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

    this.$cwa.eventBus.on('componentMounted', this.componentMountedListener)
  }

  public clear () {
    if (!this.currentIri) {
      return
    }
    this.$cwa.eventBus.off('componentMounted', this.componentMountedListener)
    this.removeClickEventListeners()
    this.currentIri = undefined
    this.domElements = []
  }

  // REFRESHING INITIALISATION
  private componentMountedListener (iri: string) {
    if (this.childIris.value.includes(iri)) {
      this.removeClickEventListeners()
      this.addClickEventListeners()
    }
  }

  // COMPUTED FOR REFRESHING
  private get childIris (): ComputedRef<string[]> {
    return computed(() => {
      if (!this.currentIri) {
        return []
      }
      const getChildren = (iri: string) => {
        const nested = []
        const resource = this.$cwa.resources.getResource(iri)
        const type = getResourceTypeFromIri(iri)
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
    if (currentEl.nodeType === 1) {
      return [currentEl]
    }
    while (currentEl?.nextSibling) {
      currentEl.nodeType !== 3 && allSiblings.push(currentEl)
      currentEl = currentEl.nextSibling
    }

    return allSiblings
  }

  private addClickEventListeners () {
    this.domElements = this.getAllEls()
    for (const el of this.domElements) {
      el.addEventListener('click', this, false)
    }
  }

  private removeClickEventListeners () {
    for (const el of this.domElements) {
      el.removeEventListener('click', this)
    }
  }

  // This will be called by the click event listener in context of this, and can be removed as well.
  // if we define with a name and call that, the `this` context will be the clicked dom element
  private handleEvent () {
    if (!this.currentIri) {
      return
    }
    // eslint-disable-next-line no-console
    console.log(`TEMP LOGGING: Click handled for ${this.currentIri}`, this.domElements)
  }
}

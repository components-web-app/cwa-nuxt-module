import { ComponentPublicInstance } from 'vue'
import logger from 'consola'

export default class ManageableComponent {
  private currentIri: string|undefined
  private domElements: any[] = []
  // eslint-disable-next-line no-useless-constructor
  constructor (private component: ComponentPublicInstance) {
  }

  private getAllEls (): any[] {
    const allSiblings: any[] = []
    let currentEl: any = this.component.$el
    if (currentEl.nodeType === 1) {
      return [currentEl]
    }
    while (currentEl?.nextSibling) {
      currentEl.nodeType !== 3 && allSiblings.push(currentEl)
      currentEl = currentEl.nextSibling
    }

    return allSiblings
  }

  private handleEvent () {
    if (!this.currentIri) {
      return
    }
    console.log(`Click handled for ${this.currentIri}`)
  }

  public initCwaManagerResource (iri: string) {
    // because we need to be able to call this once resolving an IRI in some cases, if this is called again with a new
    // IRI, we should destroy what we need to for the old iri which is no longer relevant for this component instance
    if (this.currentIri) {
      if (this.currentIri === iri) {
        return
      }
      this.destroyCwaManagerResource()
    }

    this.currentIri = iri
    this.domElements = this.getAllEls()
    for (const el of this.domElements) {
      el.addEventListener('click', this, false)
    }
  }

  public destroyCwaManagerResource () {
    if (!this.currentIri) {
      return
    }
    logger.trace(`Destroy manager resource ${this.currentIri}`)
    for (const el of this.domElements) {
      el.removeEventListener('click', this)
    }

    this.currentIri = undefined
    this.domElements = []
  }
}

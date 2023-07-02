import { ComponentPublicInstance } from 'vue'
import logger from 'consola'

export default class ManageableComponent {
  private currentIri: string|undefined
  // eslint-disable-next-line no-useless-constructor
  constructor (private proxy: ComponentPublicInstance) {
  }

  private getAllEls (): any[] {
    const allSiblings: any[] = []
    let currentEl: any = this.proxy.$el
    if (currentEl.nodeType === 1) {
      return [currentEl]
    }
    while (currentEl?.nextSibling) {
      currentEl.nodeType !== 3 && allSiblings.push(currentEl)
      currentEl = currentEl.nextSibling
    }

    return allSiblings
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

    // Just testing this works, getAllEls will probably be called on click to calculate what needs highlighting
    const allEls = this.getAllEls()
    console.log(iri, allEls)

    this.currentIri = iri
  }

  public destroyCwaManagerResource () {
    if (!this.currentIri) {
      return
    }
    logger.trace(`Destroy manager resource ${this.currentIri}`)
  }
}

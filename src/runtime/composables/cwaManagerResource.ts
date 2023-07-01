import { getCurrentInstance, onBeforeUnmount, onMounted, ComponentPublicInstance } from 'vue'
import logger from 'consola'

export const useCwaManagerResource = (iri?: string) => {
  const proxy = getCurrentInstance()?.proxy
  let initIri: string|undefined
  if (!proxy) {
    logger.error('Cannot initialise manager for resource. Instance is not defined')
    return {}
  }

  function getAllEls (proxy: ComponentPublicInstance) {
    const allSiblings = []
    let currentEl = proxy.$el
    if (currentEl.nodeType === 1) {
      return [currentEl]
    }
    while (currentEl?.nextSibling) {
      currentEl.nodeType !== 3 && allSiblings.push(currentEl)
      currentEl = currentEl.nextSibling
    }
    return allSiblings
  }

  function initCwaManagerResource (iri: string) {
    if (initIri) {
      if (initIri === iri) {
        return
      }
      destroyCwaManagerResource()
    }
    const allEls = getAllEls(proxy)
    console.log(iri, allEls)

    initIri = iri
  }

  function destroyCwaManagerResource () {
    if (!initIri) {
      return
    }
    logger.trace(`Destroy manager resource ${initIri}`)
  }

  onMounted(() => {
    if (iri) {
      initCwaManagerResource(iri)
    }
  })

  onBeforeUnmount(() => {
    destroyCwaManagerResource()
  })

  return {
    initCwaManagerResource
  }
}

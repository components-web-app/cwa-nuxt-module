import { computed, ref, shallowRef, watch } from 'vue'
import type { Ref, ComputedRef, ShallowRef } from 'vue'
import { consola as logger } from 'consola'
import { AdminStore } from '../storage/stores/admin/admin-store'
import type { ComponentUi, ManagerTab } from '#cwa/module'
import { ResourcesStore } from '#cwa/runtime/storage/stores/resources/resources-store'
import type { StyleOptions } from '#cwa/runtime/admin/manageable-component'

interface resourceStackItem {
  iri: string
  domElements: Ref<HTMLElement[]>
  displayName?: string,
  managerTabs?: ManagerTab[],
  ui?: ComponentUi[],
  childIris: ComputedRef<string[]>
  styles?: StyleOptions
}

// will be used to have additional properties not sent by the initial addToStack event
export interface ResourceStackItem extends resourceStackItem {
}

interface AddToStackWindowEvent {
  clickTarget: EventTarget | null
}

interface AddToStackEvent extends resourceStackItem, AddToStackWindowEvent {
}

export default class ComponentManager {
  private lastClickTarget: Ref<EventTarget|null> = ref(null)
  private currentResourceStack: ShallowRef<ResourceStackItem[]> = shallowRef([])
  public readonly forcePublishedVersion: Ref<boolean|undefined> = ref()
  public readonly showManager: Ref<boolean> = ref(false)
  private readonly cachedCurrentStackItem = shallowRef<undefined|ResourceStackItem>()
  private replaceCounter = ref(0)

  constructor (private adminStoreDefinition: AdminStore, private readonly resourcesStoreDefinition: ResourcesStore) {
    this.listenEditModeChange()
    this.listenCurrentIri()
    watch(this.currentStackItem, (currentStackItem) => {
      this.cachedCurrentStackItem.value = currentStackItem
    })
  }

  public get resourceStack () {
    return computed(() => {
      return this.lastClickTarget.value ? [] : this.currentResourceStack.value
    })
  }

  public get isPopulating () {
    return computed(() => !!this.lastClickTarget.value)
  }

  public get currentStackItem () {
    return computed(() => {
      if (!this.showManager.value) {
        return
      }
      // processing new stack, keep returning previous
      if (this.lastClickTarget.value) {
        return this.cachedCurrentStackItem.value
      }
      // this is required because the resourceStackItem is a shallow ref and will not trigger an update when replaced with same IRI
      // eslint-disable-next-line no-unused-expressions
      this.replaceCounter.value
      // currentResourceStack is a shallowRef and an array, unless the length changes, it basically doesn't trigger for
      // this computed variable to update. this is an issue when replacing the stack item
      return this.lastClickTarget.value ? undefined : this.currentResourceStack.value[0]
    })
  }

  public get currentIri () {
    return computed(() => {
      const currentStackItem = this.currentStackItem.value
      if (!currentStackItem) {
        return
      }
      const stackIri = currentStackItem.iri
      if (this.forcePublishedVersion.value === undefined) {
        return stackIri
      }
      if (this.forcePublishedVersion.value) {
        return this.resourcesStore.findPublishedComponentIri(stackIri)
      }
      return this.resourcesStore.findDraftComponentIri(stackIri)
    })
  }

  public resetStack () {
    this.lastClickTarget.value = null
    this.currentResourceStack.value = []
  }

  public selectStackIndex (index: number) {
    const currentLength = this.currentResourceStack.value.length
    if (!currentLength) {
      this.showManager.value = false
      return
    }
    if (index < 0 || index > currentLength - 1) {
      logger.error(`Cannot select stack index: '${index}' is out of range`)
      return
    }
    this.currentResourceStack.value = this.currentResourceStack.value.slice(index)
    this.showManager.value = true
  }

  public addToStack (event: AddToStackEvent|AddToStackWindowEvent) {
    const { clickTarget, ...resourceStackItem } = event

    const isResourceClick = ('iri' in resourceStackItem)

    if (!this.isEditing) {
      this.resetStack()
      return
    }
    if (isResourceClick && this.isItemAlreadyInStack(resourceStackItem.iri) && this.lastClickTarget.value) {
      return
    }

    // we are starting a new stack - last click before was a window or has been reset
    if (!this.lastClickTarget.value) {
      this.resetStack()
    }

    if (!isResourceClick) {
      this.lastClickTarget.value = null
      return
    }

    this.insertResourceStackItem(resourceStackItem as ResourceStackItem)
    this.lastClickTarget.value = clickTarget
  }

  public replaceCurrentStackItem (resourceStackItem: ResourceStackItem) {
    // has to be set with the equals otherwise we lose reactivity and not watchers triggered
    this.currentResourceStack.value.shift()
    this.currentResourceStack.value.unshift(resourceStackItem)
    this.replaceCounter.value++
  }

  // todo: test checking and inserting at correct index
  private insertResourceStackItem (resourceStackItem: ResourceStackItem) {
    const iris = [resourceStackItem.iri]
    const relatedIri = this.resourcesStore.draftToPublishedIris[resourceStackItem.iri] || this.resourcesStore.publishedToDraftIris[resourceStackItem.iri]
    relatedIri && iris.push(relatedIri)
    const insertAtIndex = this.currentResourceStack.value.findIndex((existingStackItem) => {
      const existingItemChildren = existingStackItem.childIris.value
      if (!existingItemChildren) {
        return false
      }
      return existingItemChildren.some((r: string) => iris.includes(r))
    })
    insertAtIndex === -1 ? this.currentResourceStack.value.push(resourceStackItem) : this.currentResourceStack.value.splice(insertAtIndex, 0, resourceStackItem)
  }

  private listenEditModeChange () {
    watch(() => this.isEditing, (isEditing) => {
      if (!isEditing) {
        // if we reset the stack then the resource manager disappears and no item/tabs selected immediately
        this.showManager.value = false
      }
    })
  }

  private listenCurrentIri () {
    watch(this.currentIri, (newIri, oldIri) => {
      if (newIri && oldIri) {
        if ([this.resourcesStore.publishedToDraftIris[oldIri], this.resourcesStore.draftToPublishedIris[oldIri]].includes(newIri)) {
          return
        }
      }
      this.forcePublishedVersion.value = undefined
    })
  }

  private isItemAlreadyInStack (iri: string): boolean {
    return !!this.currentResourceStack.value.find(el => el.iri === iri)
  }

  private get isEditing () {
    return this.adminStore.state.isEditing
  }

  private get adminStore () {
    return this.adminStoreDefinition.useStore()
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }
}

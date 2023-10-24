import { computed, ref, shallowRef, watch } from 'vue'
import type { Ref, ShallowRef, ComputedRef } from 'vue'
import { consola as logger } from 'consola'
import { AdminStore } from '../storage/stores/admin/admin-store'
import type { ComponentUi, ManagerTab } from '#cwa/module'
import { ResourcesStore } from '#cwa/runtime/storage/stores/resources/resources-store'

interface _ResourceStackItem {
  iri: string
  domElements: Ref<HTMLElement[]>
  displayName?: string,
  managerTabs?: ManagerTab[],
  ui?: ComponentUi[],
  childIris: ComputedRef<string[]>
}

// will be used to have additional properties not sent by the initial addToStack event
export interface ResourceStackItem extends _ResourceStackItem {
}

interface AddToStackWindowEvent {
  clickTarget: EventTarget | null
}

interface AddToStackEvent extends _ResourceStackItem, AddToStackWindowEvent {
}

export default class ComponentManager {
  private lastClickTarget: Ref<EventTarget|null> = ref(null)
  private currentResourceStack: ShallowRef<ResourceStackItem[]> = shallowRef([])
  public readonly forcePublishedVersion: Ref<boolean|undefined> = ref()
  public readonly showManager: Ref<boolean> = ref(false)
  private readonly cachedCurrentStackItem = shallowRef<undefined|ResourceStackItem>()

  constructor (private adminStoreDefinition: AdminStore, private readonly resourcesStoreDefinition: ResourcesStore) {
    this.listenEditModeChange()
    this.listenCurrentIri()
  }

  public get resourceStack () {
    return computed(() => {
      return this.lastClickTarget.value ? [] : this.currentResourceStack.value
    })
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
      this.cachedCurrentStackItem.value = this.resourceStack.value?.[0]
      return this.cachedCurrentStackItem.value
    })
  }

  public get currentIri () {
    return computed(() => {
      if (!this.currentStackItem.value) {
        return
      }
      const stackIri = this.currentStackItem.value.iri
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
    // shallow ref, cannot splice - will not trigger reactivity - for some reason here...
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

    // @ts-ignore-next-line : this type has been determined by the above check for isResourceClick, but ts thinks can still be AddToStackWindowEvent
    this.insertResourceStackItem(resourceStackItem)
    this.lastClickTarget.value = clickTarget
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

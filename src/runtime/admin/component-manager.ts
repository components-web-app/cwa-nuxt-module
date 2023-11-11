import { computed, createApp, ref, shallowRef, watch } from 'vue'
import type { ComponentPublicInstance, Ref, ComputedRef, ShallowRef } from 'vue'
import { consola as logger } from 'consola'
import type { App } from 'vue/dist/vue'
import { AdminStore } from '../storage/stores/admin/admin-store'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import ComponentFocus from '../templates/components/main/admin/resource-manager/ComponentFocus.vue'
import type { StyleOptions } from './manageable-component'
import type { ComponentUi, ManagerTab } from '#cwa/module'

interface resourceStackItem {
  iri: string
  domElements: Ref<HTMLElement[]>
  displayName?: string,
  managerTabs?: ManagerTab[],
  ui?: ComponentUi[],
  childIris: ComputedRef<string[]>
  styles?: ComputedRef<StyleOptions>
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
  private readonly lastClickTarget: Ref<EventTarget|null> = ref(null)
  private readonly currentResourceStack: ShallowRef<ResourceStackItem[]> = shallowRef([])
  private readonly lastContextTarget: Ref<EventTarget|null> = ref(null)
  private readonly contextResourceStack: ShallowRef<ResourceStackItem[]> = shallowRef([])
  public readonly forcePublishedVersion: Ref<boolean|undefined> = ref()
  public readonly showManager: Ref<boolean> = ref(false)
  private readonly cachedCurrentStackItem = shallowRef<undefined|ResourceStackItem>()
  private focusComponent: App|undefined
  private focusWrapper: HTMLElement|undefined
  private focusProxy: ComponentPublicInstance|undefined

  constructor (private adminStoreDefinition: AdminStore, private readonly resourcesStoreDefinition: ResourcesStore) {
    this.listenEditModeChange()
    this.listenCurrentIri()
    watch(this.currentStackItem, (currentStackItem) => {
      this.createFocusComponent()
      this.cachedCurrentStackItem.value = currentStackItem
    })
  }

  public get contextStack () {
    return computed(() => {
      return this.lastContextTarget.value ? [] : this.contextResourceStack.value
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

  public get isContextPopulating () {
    return computed(() => !!this.lastContextTarget.value)
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

  public resetStack (isContext?: boolean) {
    if (isContext) {
      this.lastContextTarget.value = null
      this.contextResourceStack.value = []
      return
    }
    this.lastClickTarget.value = null
    this.currentResourceStack.value = []
  }

  public selectStackIndex (index: number, fromContext?: boolean) {
    const fromStack = fromContext ? this.contextResourceStack : this.currentResourceStack
    const currentLength = fromStack.value.length
    if (!currentLength) {
      this.showManager.value = false
      return
    }
    if (index < 0 || index > currentLength - 1) {
      logger.error(`Cannot select stack index: '${index}' is out of range`)
      return
    }
    this.currentResourceStack.value = fromStack.value.slice(index)
    this.showManager.value = true
    if (fromContext) {
      this.resetStack(true)
    }
  }

  public addToStack (event: AddToStackEvent|AddToStackWindowEvent, isContext?: boolean) {
    if (!this.isEditing) {
      return
    }

    const { clickTarget, ...resourceStackItem } = event
    const isResourceClick = ('iri' in resourceStackItem)

    if (isResourceClick && this.isItemAlreadyInStack(resourceStackItem.iri, isContext) && this.lastClickTarget.value) {
      return
    }

    const lastTarget = isContext ? this.lastContextTarget : this.lastClickTarget

    // we are starting a new stack - last click before was a window or has been reset
    if (!lastTarget.value) {
      this.resetStack(isContext)
      // clear the context menu on click
      if (!isContext) {
        this.resetStack(true)
      }
    }

    // the last click target is not a resource and finished the chain
    if (!isResourceClick) {
      lastTarget.value = null
      return
    }

    this.insertResourceStackItem(resourceStackItem as ResourceStackItem, isContext)
    lastTarget.value = clickTarget
  }

  // todo: test checking and inserting at correct index
  private insertResourceStackItem (resourceStackItem: ResourceStackItem, isContext?: boolean) {
    const stack = isContext ? this.contextResourceStack : this.currentResourceStack
    const iris = [resourceStackItem.iri]
    const relatedIri = this.resourcesStore.draftToPublishedIris[resourceStackItem.iri] || this.resourcesStore.publishedToDraftIris[resourceStackItem.iri]
    relatedIri && iris.push(relatedIri)
    const insertAtIndex = stack.value.findIndex((existingStackItem) => {
      const existingItemChildren = existingStackItem.childIris.value
      if (!existingItemChildren) {
        return false
      }
      return existingItemChildren.some((r: string) => iris.includes(r))
    })
    insertAtIndex === -1 ? stack.value.push(resourceStackItem) : stack.value.splice(insertAtIndex, 0, resourceStackItem)
  }

  public updateFocusComponentSize () {
    if (!this.focusProxy) {
      return
    }
    this.focusProxy.updateWindowSize()
  }

  private createFocusComponent () {
    this.removeFocusComponent()
    const stackItem = this.currentStackItem.value
    if (!this.currentIri || !stackItem) {
      return
    }

    this.focusComponent = createApp(ComponentFocus, {
      iri: this.currentIri,
      domElements: stackItem.domElements
    })

    this.focusWrapper = document.createElement('div')
    document.body.appendChild(this.focusWrapper)

    this.focusProxy = this.focusComponent.mount(this.focusWrapper)
  }

  private removeFocusComponent () {
    if (this.focusComponent) {
      this.focusComponent.unmount()
      this.focusComponent = undefined
      this.focusProxy = undefined
    }
    if (this.focusWrapper) {
      this.focusWrapper.remove()
      this.focusWrapper = undefined
    }
  }

  private listenEditModeChange () {
    watch(() => this.isEditing, (isEditing) => {
      if (!isEditing) {
        // if we reset the stack then the resource manager disappears and no item/tabs selected immediately
        this.showManager.value = false
        // can clear the context menu stack though
        this.resetStack(true)
      }
    })
  }

  private listenCurrentIri () {
    watch(this.currentIri, (newIri, oldIri) => {
      if (newIri && oldIri) {
        if (this.resourcesStore.isIriPublishableEquivalent(oldIri, newIri)) {
          return
        }
      }
      this.resetResourceManagerVars()
    })
  }

  private resetResourceManagerVars () {
    this.forcePublishedVersion.value = undefined
  }

  private isItemAlreadyInStack (iri: string, isContext?: boolean): boolean {
    const stack = isContext ? this.contextResourceStack : this.currentResourceStack
    return !!stack.value.find(el => el.iri === iri)
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

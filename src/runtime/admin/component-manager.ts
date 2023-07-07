import { Ref, ComponentPublicInstance, watch } from 'vue'
import { AdminStore } from '../storage/stores/admin/admin-store'

interface _ResourceStackItem {
  iri: string
  domElements: Ref<HTMLElement[]>
  displayName: string | null
  componentInstance: ComponentPublicInstance
}

// will be used to have additional properties not sent by the initial addToStack event
interface ResourceStackItem extends _ResourceStackItem {
}

interface AddToStackWindowEvent {
  clickTarget: EventTarget | null
}

interface AddToStackEvent extends _ResourceStackItem, AddToStackWindowEvent {
}

export default class ComponentManager {
  private lastClickTarget: EventTarget | null = null
  private currentResourceStack: ResourceStackItem[] = []

  constructor (private adminStoreDefinition: AdminStore) {
    this.listenEditModeChange()
  }

  public get resourceStack () {
    return this.currentResourceStack
  }

  public get currentStackItem () {
    return this.resourceStack[0]
  }

  public resetStack () {
    this.lastClickTarget = null
    this.currentResourceStack = []
  }

  private listenEditModeChange () {
    watch(() => this.isEditing, (status) => {
      if (!status) {
        this.resetStack()
      }
    })
  }

  private isItemAlreadyInStack (iri: string): boolean {
    return !!this.currentResourceStack.find(el => el.iri === iri)
  }

  public addToStack (event: AddToStackEvent|AddToStackWindowEvent) {
    const { clickTarget, ...resourceStackItem } = event

    const isWindowClickEvent = !('iri' in resourceStackItem)

    if (!this.isEditing || (!isWindowClickEvent && this.isItemAlreadyInStack(resourceStackItem.iri))) {
      return
    }

    const isNewClickTarget = clickTarget !== this.lastClickTarget

    if (isWindowClickEvent) {
      if (isNewClickTarget) {
        this.resetStack()
      }
      return
    }

    if (isNewClickTarget) {
      this.lastClickTarget = clickTarget
    }

    this.currentResourceStack.push(resourceStackItem)
  }

  private get isEditing () {
    return this.adminStore.state.isEditing
  }

  private get adminStore () {
    return this.adminStoreDefinition.useStore()
  }
}

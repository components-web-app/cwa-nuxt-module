import { Ref, ComponentPublicInstance, watch, WatchStopHandle } from 'vue'
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
  private unwatch: WatchStopHandle | null = null

  // eslint-disable-next-line no-useless-constructor
  constructor (private adminStoreDefinition: AdminStore) {
  }

  public get resourceStack () {
    return this.currentResourceStack
  }

  public resetStack () {
    this.lastClickTarget = null
    this.currentResourceStack = []
  }

  private listenEditModeChange () {
    if (this.unwatch) {
      return
    }

    this.unwatch = watch(() => this.isEditing, (status) => {
      if (!status) {
        this.resetStack()
      }
    })
  }

  private isItemAlreadyInStack (iri: string): boolean {
    return !!this.currentResourceStack.find(el => el.iri === iri)
  }

  public addToStack (event: AddToStackEvent|AddToStackWindowEvent) {
    this.listenEditModeChange()

    if (!this.isEditing || this.isItemAlreadyInStack((event as AddToStackEvent).iri)) {
      return
    }

    const isWindowClickEvent = !('iri' in event)
    const isNewClickTarget = event.clickTarget !== this.lastClickTarget

    if (isWindowClickEvent) {
      if (isNewClickTarget) {
        this.resetStack()
      }
      return
    }

    if (isNewClickTarget) {
      this.lastClickTarget = event.clickTarget
    }

    const resourceStackItem: ResourceStackItem = event
    this.currentResourceStack.push(resourceStackItem)
  }

  private get isEditing () {
    return this.adminStore.state.isEditing
  }

  private get adminStore () {
    return this.adminStoreDefinition.useStore()
  }
}

import { computed, ref, Ref, watch } from 'vue'
import { AdminStore } from '../storage/stores/admin/admin-store'

interface _ResourceStackItem {
  iri: string
  domElements: Ref<HTMLElement[]>
  displayName: string | null
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
  private currentResourceStack: Ref<ResourceStackItem[]> = ref([])

  constructor (private adminStoreDefinition: AdminStore) {
    this.listenEditModeChange()
  }

  public get resourceStack () {
    return this.currentResourceStack
  }

  public get currentStackItem () {
    return computed(() => {
      return this.resourceStack.value?.[0] || null
    })
  }

  public resetStack () {
    this.lastClickTarget = null
    this.currentResourceStack.value = []
  }

  private listenEditModeChange () {
    watch(() => this.isEditing, (status) => {
      if (!status) {
        this.resetStack()
      }
    })
  }

  private isItemAlreadyInStack (iri: string): boolean {
    return !!this.currentResourceStack.value.find(el => el.iri === iri)
  }

  public addToStack (event: AddToStackEvent|AddToStackWindowEvent) {
    const { clickTarget, ...resourceStackItem } = event

    const isResourceClick = ('iri' in resourceStackItem)

    if (
      !this.isEditing ||
      (isResourceClick && this.isItemAlreadyInStack(resourceStackItem.iri) && this.lastClickTarget)
    ) {
      return
    }

    // we are starting a new stack - last click before was a window or has been reset
    if (!this.lastClickTarget) {
      this.resetStack()
    }

    isResourceClick && this.currentResourceStack.value.push(resourceStackItem)

    this.lastClickTarget = isResourceClick ? clickTarget : null
  }

  private get isEditing () {
    return this.adminStore.state.isEditing
  }

  private get adminStore () {
    return this.adminStoreDefinition.useStore()
  }
}

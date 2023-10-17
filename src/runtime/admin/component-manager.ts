import { computed, ref, Ref, watch } from 'vue'
import { consola as logger } from 'consola'
import { AdminStore } from '../storage/stores/admin/admin-store'
import { ManagerTab } from '#cwa/module'

interface _ResourceStackItem {
  iri: string
  domElements: Ref<HTMLElement[]>
  displayName?: string,
  managerTabs?: ManagerTab[]
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
  private currentResourceStack: Ref<ResourceStackItem[]> = ref([])
  public readonly showManager: Ref<boolean> = ref(false)

  constructor (private adminStoreDefinition: AdminStore) {
    this.listenEditModeChange()
  }

  public get resourceStack () {
    return computed(() => {
      return this.lastClickTarget.value ? [] : this.currentResourceStack.value
    })
  }

  public get currentStackItem () {
    return computed(() => {
      return (this.lastClickTarget.value || !this.showManager.value) ? null : this.resourceStack.value?.[0] || null
    })
  }

  public resetStack () {
    this.lastClickTarget.value = null
    this.currentResourceStack.value = []
  }

  private listenEditModeChange () {
    watch(() => this.isEditing, (isEditing) => {
      if (!isEditing) {
        // if we reset the stack then the resource manager disappears and no item/tabs selected immediately
        this.showManager.value = false
      }
    })
  }

  private isItemAlreadyInStack (iri: string): boolean {
    return !!this.currentResourceStack.value.find(el => el.iri === iri)
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

    isResourceClick && this.currentResourceStack.value.push(resourceStackItem)
    this.lastClickTarget.value = isResourceClick ? clickTarget : null
  }

  private get isEditing () {
    return this.adminStore.state.isEditing
  }

  private get adminStore () {
    return this.adminStoreDefinition.useStore()
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
    this.currentResourceStack.value.splice(0, index)
    this.showManager.value = true
  }
}

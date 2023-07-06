import { Ref, ComponentPublicInstance } from 'vue'

interface _ResourceStackItem {
  iri: string
  domElements: Ref<HTMLElement[]>
  displayName: string|null
  componentInstance: ComponentPublicInstance
}

// will be used to have additional properties not sent by the initial addToStack event
interface ResourceStackItem extends _ResourceStackItem {
}

interface AddToStackWindowEvent {
  clickTarget: EventTarget|null
}

interface AddToStackEvent extends _ResourceStackItem, AddToStackWindowEvent {}

export default class ComponentManager {
  private lastClickTarget: HTMLElement | null = null
  private currentResourceStack: ResourceStackItem[] = []
  private isEditing = false

  public setEditMode (newEditModeStatus: boolean) {
    this.isEditing = newEditModeStatus

    if (!this.isEditing) {
      this.resetStack()
    }
  }

  public get resourceStack () {
    return this.currentResourceStack
  }

  public resetStack () {
    this.lastClickTarget = null
    this.currentResourceStack = []
  }

  public resetStackOnClickMiss (element: HTMLElement) {
    if (!this.isEditing) {
      return
    }

    if (this.lastClickTarget !== element) {
      this.resetStack()
    }
  }

  public addToStack (event: AddToStackEvent | AddToStackWindowEvent) {
    if (!this.isEditing) {
      return
    }

    if (event.clickTarget !== this.lastClickTarget) {
      this.resetStack()

      this.lastClickTarget = event.clickTarget as HTMLElement
    }

    this.currentResourceStack.push(event as ResourceStackItem)
  }
}

import { Ref } from 'vue'

interface _ResourceStackItem {
  iri: string
  domElements: Ref<HTMLElement[]>
}

// will be used to have additional properties not sent by the initial addToStack event
interface ResourceStackItem extends _ResourceStackItem {
}

interface AddToStackWindowEvent {
  clickTarget: EventTarget|null
}

interface AddToStackEvent extends _ResourceStackItem, AddToStackWindowEvent {}

export default class ComponentManager {
  private lastClickTarget: HTMLElement|undefined
  private currentResourceStack: ResourceStackItem[] = []
  private isEditing = false

  public setEditMode (newEditModeStatus: boolean) {
    this.isEditing = newEditModeStatus

    if (!this.isEditing) {
      this.resetStack()
    }
  }

  public resetStack () {
    console.log('reset stack')
  }

  public addToStack (event: AddToStackEvent | AddToStackWindowEvent) {
    if (!this.isEditing) {
      return
    }
    // eslint-disable-next-line no-console
    console.log('addToStack', event)
  }
}

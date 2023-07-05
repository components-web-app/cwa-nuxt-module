interface _ResourceStackItem {
  iri: string
  domElements: HTMLElement[]
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

  public resetStack () {}

  public addToStack (event: AddToStackEvent | AddToStackWindowEvent) {
    // eslint-disable-next-line no-console
    console.log('addToStack', event)
  }
}

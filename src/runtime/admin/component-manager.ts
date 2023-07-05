interface ResourceStackItem {

}

interface AddToStackEvent {
  iri: string
  domElements: HTMLElement[]
  clickTarget: EventTarget|null
}

export default class ComponentManager {
  private lastClickTarget: HTMLElement|undefined
  private currentResourceStack: ResourceStackItem[] = []

  public addToStack (event: AddToStackEvent) {
    // eslint-disable-next-line no-console
    console.log('addToStack', event)
  }
}

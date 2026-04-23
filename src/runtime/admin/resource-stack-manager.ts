import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import type { Resources } from '#cwa/resources/resources'
import ConfirmDialog from '#cwa/templates/components/core/ConfirmDialog.vue'
import type { ComponentUi, ManagerTab } from '#cwa/types'
import { useNuxtApp } from '#imports'
import { consola as logger } from 'consola'
import type { App, ComponentPublicInstance, ComputedRef, Ref, ShallowRef } from 'vue'
import { computed, createApp, nextTick, ref, shallowRef, watch } from 'vue'
import { createConfirmDialog } from 'vuejs-confirm-dialog'
import type { AdminStore, CwaAdminStoreInterface } from '../storage/stores/admin/admin-store'
import type { CwaResourcesStoreInterface, ResourcesStore } from '../storage/stores/resources/resources-store'
import ComponentFocus from '../templates/components/main/admin/resource-manager/ComponentFocus.vue'
import type { ManageableResourceOps, StyleOptions } from './manageable-resource'

interface _ResourceStackItem {
  iri: string
  domElements: Ref<HTMLElement[]>
  displayName?: string
  managerTabs?: ManagerTab[]
  ui?: ComponentUi[]
  childIris: Ref<string[]>
  styles?: ComputedRef<StyleOptions | undefined>
  resourceOps?: ManageableResourceOps
}

// can be used to have additional properties not sent by the initial addToStack event
export type ResourceStackItem = _ResourceStackItem

interface AddToStackWindowEvent {
  clickTarget: EventTarget | null
}

interface AddToStackEvent extends _ResourceStackItem, AddToStackWindowEvent {
}

export interface AddResourceEvent {
  addAfter: boolean | null
  targetIri: string
  closest: {
    position?: string
    group?: string
  }
  pageDataProperty?: string
}

type GroupDisabledCacheItem = { iri: string, location?: string, isDisabled: boolean }

export default class ResourceStackManager {
  public readonly forcePublishedVersion: Ref<boolean | undefined> = ref()
  public readonly showManager: Ref<boolean> = ref(false)
  private readonly isLayoutStack: Ref<boolean> = ref(false)
  private readonly _isEditingLayout: Ref<boolean> = ref(false)
  private readonly currentClickTarget: Ref<EventTarget | null> = ref(null)
  private readonly currentResourceStack: ShallowRef<ResourceStackItem[]> = shallowRef([])
  private readonly previousResourceStack: ShallowRef<ResourceStackItem[]> = shallowRef([])
  private readonly lastContextTarget: Ref<EventTarget | null> = ref(null)
  private readonly contextResourceStack: ShallowRef<ResourceStackItem[]> = shallowRef([])
  private readonly cachedCurrentStackItem = shallowRef<undefined | ResourceStackItem>()
  private readonly resourceManagerState = ref({} as Record<string, any>)
  private readonly yOffset = 100
  private focusComponent: App | undefined
  private focusWrapper: HTMLElement | undefined
  private focusProxy: ComponentPublicInstance | undefined
  private _currentStackItem: ComputedRef<undefined | ResourceStackItem> | undefined
  private _currentIri: ComputedRef<string | undefined> | undefined
  private readonly _adminStore: CwaAdminStoreInterface
  private readonly _resourcesStore: CwaResourcesStoreInterface

  constructor(private adminStoreDefinition: AdminStore, private readonly resourcesStoreDefinition: ResourcesStore, private readonly resources: Resources) {
    this._adminStore = this.adminStoreDefinition.useStore()
    this._resourcesStore = this.resourcesStoreDefinition.useStore()
    watch(() => this.isEditing, this.listenEditModeChange.bind(this))
    watch(this.currentIri, this.listenCurrentIri.bind(this))
    watch(this.currentStackItem, this.handleCurrentStackItemChange.bind(this))
    watch(this.showManager, newValue => !newValue && this.removeFocusComponent())
  }

  private async handleCurrentStackItemChange(currentStackItem: ResourceStackItem | undefined) {
    this.cachedCurrentStackItem.value = currentStackItem
    await nextTick()
    this.scrollIntoView()
    this.createFocusComponent()
  }

  public get isEditingLayout() {
    return this._isEditingLayout
  }

  public getState(prop: string) {
    return this.resourceManagerState.value[prop]
  }

  public setState(prop: string, value: any) {
    Object.assign(this.resourceManagerState.value, { [prop]: value })
  }

  public get contextStack() {
    return computed(() => {
      return this.lastContextTarget.value ? [] : this.contextResourceStack.value
    })
  }

  public get resourceStack() {
    return computed(() => {
      return this.currentClickTarget.value ? [] : this.currentResourceStack.value
    })
  }

  public get isPopulating() {
    return computed(() => !!this.currentClickTarget.value)
  }

  public get isContextPopulating() {
    return computed(() => !!this.lastContextTarget.value)
  }

  public get currentStackItem() {
    if (!this._currentStackItem) {
      this._currentStackItem = computed(() => {
        if (!this.showManager.value) {
          return
        }
        // processing new stack, keep returning previous
        if (this.currentClickTarget.value) {
          return this.cachedCurrentStackItem.value
        }
        // currentResourceStack is a shallowRef and an array, unless the length changes, it basically doesn't trigger for
        // this computed variable to update. this is an issue when replacing the stack item
        return this.currentResourceStack.value[0]
      })
    }
    return this._currentStackItem
  }

  public get currentIri() {
    if (!this._currentIri) {
      this._currentIri = computed(() => {
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
    return this._currentIri
  }

  public resetStack(clearContextStack?: boolean) {
    if (clearContextStack) {
      this.lastContextTarget.value = null
      this.contextResourceStack.value = []
      return
    }

    this.previousResourceStack.value = this.currentResourceStack.value
    this.currentClickTarget.value = null
    this.currentResourceStack.value = []
  }

  public getClosestStackItemByType(type: CwaResourceTypes) {
    const currentStack = this.resourceStack.value
    for (const stackItem of currentStack) {
      const stackItemIri = stackItem.iri
      const resourceType = getResourceTypeFromIri(stackItemIri)
      if (resourceType === type) {
        return stackItemIri
      }
    }
  }

  private async confirmStackChange(alertData: { title: string, content: string }, fromContext?: boolean) {
    let cachedNewStack: ResourceStackItem[] | undefined
    if (!fromContext) {
      cachedNewStack = this.currentResourceStack.value
      this.currentResourceStack.value = this.previousResourceStack.value
    }

    // @ts-expect-error-next-line
    const dialog = createConfirmDialog(ConfirmDialog)
    const { isCanceled } = await dialog.reveal(alertData)
    if (isCanceled) {
      if (fromContext) {
        // can prevent the context stack from becoming the currentResourceStack easily here
        this.resetStack(true)
      }
      return false
    }

    if (cachedNewStack) {
      this.currentResourceStack.value = cachedNewStack
    }
    return true
  }

  public async selectStackIndex(index: number, fromContext: boolean) {
    if (!this.isEditing) {
      return
    }
    const fromStack = fromContext ? this.contextResourceStack : this.currentResourceStack
    const currentLength = fromStack.value.length

    if (!currentLength) {
      this.isLayoutStack.value = this._isEditingLayout.value
      this.showManager.value = false
      return
    }
    if (index < 0 || index > currentLength - 1) {
      logger.error(`Cannot select stack index: '${index}' is out of range`)
      return
    }

    // todo: switching to edit the layout from the Dev should also be able to trigger this notice...
    if (this._isEditingLayout.value !== this.isLayoutStack.value) {
      const confirmed = await this.confirmStackChange({ title: 'Are you sure?', content: `<p>Are you sure you want to switch and edit the ${this.isLayoutStack.value ? 'layout' : 'page'}?</p>` }, fromContext)
      if (!confirmed) {
        this.isLayoutStack.value = this._isEditingLayout.value
        return
      }
      this._isEditingLayout.value = this.isLayoutStack.value
    }

    this.currentResourceStack.value = fromStack.value.slice(index)
    this.showManager.value = true
    if (fromContext) {
      this.resetStack(true)
    }
  }

  private getCurrentTarget(isContext?: boolean) {
    return isContext ? this.lastContextTarget : this.currentClickTarget
  }

  public completeStack(event: AddToStackWindowEvent, isContext?: boolean, type?: undefined | 'page' | 'layout') {
    if (type) {
      this.isLayoutStack.value = type === 'layout'
    }
    this._addToStack(event, isContext)
  }

  public addToStack(event: AddToStackEvent, isContext?: boolean, resourceOps?: ManageableResourceOps) {
    return this._addToStack(event, isContext, resourceOps)
  }

  private _addToStack(event: AddToStackEvent | AddToStackWindowEvent, isContext?: boolean, resourceOps?: ManageableResourceOps) {
    const currentTarget = this.getCurrentTarget(!!isContext)

    const { clickTarget, ...resourceStackItem } = event
    const isResourceClick = ('iri' in resourceStackItem)

    // we are starting a new stack - last click before was a window or has been reset
    if (!currentTarget.value) {
      // If the first item being added to stack is the same IRI as the first item populated into the current stack, cancel, do not repopulate the same stack
      if (!isContext && isResourceClick && this.isResourceInStack(resourceStackItem.iri, false)) {
        currentTarget.value = clickTarget
        return
      }

      this.resetStack(isContext)
      // clear the context menu on click
      if (!isContext) {
        this.resetStack(true)
      }
    }

    if (!this.isEditing) {
      return
    }

    if (isResourceClick && this.isResourceInStack(resourceStackItem.iri, !!isContext) && currentTarget.value) {
      return
    }

    // COMPLETE STACK
    // the last click target is not a resource and finished the chain
    if (!isResourceClick) {
      this.finishStack(!!isContext)
      return
    }

    resourceStackItem.resourceOps = resourceOps

    this.insertResourceStackItem(resourceStackItem as ResourceStackItem, !!isContext)
    currentTarget.value = clickTarget
  }

  private finishStack(isContext: boolean) {
    this.filterDisabledStackItems(isContext)
    this.getCurrentTarget(isContext).value = null

    if (this.currentResourceStack.value.length === 0) {
      this.previousResourceStack.value = []
    }
  }

  public isComponentGroupDisabled(iri: string, location?: string): boolean {
    if (getResourceTypeFromIri(iri) !== CwaResourceTypes.COMPONENT_GROUP) {
      return false
    }
    if (this.resources.isDataPage.value) {
      if (this.isLayoutStack.value) {
        // do not disable if we are modifying the layout
        return false
      }

      // when we are clicking it won't have a location until the stack is complete
      if (!location) {
        return true
      }

      const locationType = getResourceTypeFromIri(location)
      if (locationType === CwaResourceTypes.LAYOUT) {
        return false
      }
      return locationType !== undefined && [CwaResourceTypes.PAGE, CwaResourceTypes.PAGE_DATA].includes(locationType)
    }

    return false
  }

  private filterDisabledStackItems(isContext: boolean) {
    const stackRef = this.getCurrentStack(isContext)
    const stack = stackRef.value
    const stackEntries = stack.entries()
    const newStack: ResourceStackItem[] = []
    const groupDisabledCache: Record<string, GroupDisabledCacheItem> = {}

    const findNextComponentGroup = (startIndex: number): GroupDisabledCacheItem | undefined => {
      for (let i = startIndex; i < stack.length; i++) {
        const item = stack[i] as ResourceStackItem
        if (getResourceTypeFromIri(item.iri) === CwaResourceTypes.COMPONENT_GROUP) {
          if (groupDisabledCache[item.iri]) {
            return groupDisabledCache[item.iri]
          }

          const location = stack[i + 1]?.iri
          // if no location, it may be in the layout or the page... but top level

          groupDisabledCache[item.iri] = {
            iri: item.iri,
            location,
            isDisabled: this.isComponentGroupDisabled(item.iri, location),
          }
          return groupDisabledCache[item.iri]
        }
      }
    }

    for (const [index, item] of stackEntries) {
      const resourceType = getResourceTypeFromIri(item.iri)
      if (resourceType && [CwaResourceTypes.COMPONENT_GROUP, CwaResourceTypes.COMPONENT].includes(resourceType)) {
        const nextGroup = findNextComponentGroup(index)
        // this.resources.isDataPage.value && !this.resources.isPageDataResource(item.iri).value
        if (!this.resources.isPageDataResource(item.iri).value && nextGroup?.isDisabled) {
          continue
        }
      }
      newStack.push(item)
    }
    stackRef.value = newStack
  }

  private getCurrentStack(isContext: boolean) {
    return isContext ? this.contextResourceStack : this.currentResourceStack
  }

  private insertResourceStackItem(resourceStackItem: ResourceStackItem, isContext?: boolean) {
    // the deepest nested resource should be earliest index e.g. 0 = component (child of 1 = position (child of 2 = group))
    const stack = this.getCurrentStack(!!isContext)
    const iris = this.resourcesStore.findAllPublishableIris(resourceStackItem.iri)

    const insertAtIndex = stack.value.findIndex((existingStackItem) => {
      const existingItemChildren = existingStackItem.childIris.value
      if (!existingItemChildren) {
        return false
      }
      return existingItemChildren.some((r: string) => iris.includes(r))
    })
    insertAtIndex === -1 ? stack.value.push(resourceStackItem) : stack.value.splice(insertAtIndex, 0, resourceStackItem)
  }

  public redrawFocus() {
    if (!this.focusProxy) {
      return
    }
    // @ts-expect-error-next-line
    this.focusProxy.redraw()
  }

  private createFocusComponent() {
    this.removeFocusComponent()
    const stackItem = this.currentStackItem.value
    if (!this.currentIri.value || !stackItem) {
      return
    }

    this.focusComponent = createApp(ComponentFocus, {
      iri: this.currentIri,
      domElements: stackItem.domElements,
    })

    this.focusWrapper = document.createElement('div')
    this.focusWrapper.className = 'cwa:absolute cwa:z-10 cwa:top-0 cwa:left-0 cwa:focus-wrapper'

    useNuxtApp().vueApp._container?.appendChild(this.focusWrapper)

    this.focusProxy = this.focusComponent.mount(this.focusWrapper)
  }

  private removeFocusComponent() {
    if (this.focusComponent) {
      const toUnmount = this.focusComponent
      this.focusComponent = undefined
      this.focusProxy = undefined
      toUnmount.unmount()
    }
    if (this.focusWrapper) {
      const toRemove = this.focusWrapper
      this.focusWrapper = undefined
      toRemove.remove()
    }
  }

  private scrollIntoView() {
    let element: undefined | HTMLElement
    let elementOutOfView = false
    const stackItem = this.currentStackItem.value
    if (!stackItem) {
      return
    }

    for (const elCandidate of stackItem.domElements.value) {
      if (elCandidate.nodeType === Node.ELEMENT_NODE) {
        if (!element) {
          element = elCandidate
        }

        if (this.isElementOutsideViewport(element)) {
          elementOutOfView = true
        }
        if (elementOutOfView && element) {
          break
        }
      }
    }

    if (!element || !elementOutOfView) {
      return
    }
    const y = element.getBoundingClientRect().top + window.scrollY - this.yOffset
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  private isElementOutsideViewport(el: HTMLElement) {
    const { top, left, bottom, right } = el.getBoundingClientRect()
    const { innerHeight, innerWidth } = window
    let visibleHeight = innerHeight
    const managerSpacer = document.getElementById('cwa-manager-spacer')
    if (managerSpacer) {
      visibleHeight -= managerSpacer.offsetHeight
    }
    return top < this.yOffset || left < 0 || bottom > visibleHeight || right > innerWidth
  }

  private listenEditModeChange(isEditing: boolean) {
    if (!isEditing) {
      // if we reset the stack then the resource manager disappears and no item/tabs selected immediately
      this.showManager.value = false
      // can clear the context menu stack though
      this.resetStack(true)
      // reset to edit page again next time
      this._isEditingLayout.value = false
    }
  }

  private listenCurrentIri(newIri: string | undefined, oldIri: string | undefined) {
    if (newIri && oldIri) {
      if (this.resourcesStore.isIriPublishableEquivalent(oldIri, newIri)) {
        return
      }
    }
    this.resetResourceManagerVars()
  }

  private resetResourceManagerVars() {
    this.forcePublishedVersion.value = undefined
    this.resourceManagerState.value = {}
  }

  private isResourceInStack(iri: string, isContext?: boolean): boolean {
    const stack = isContext ? this.contextResourceStack : this.currentResourceStack
    return !!stack.value.find(el => el.iri === iri)
  }

  private get isEditing() {
    return this.adminStore.state.isEditing
  }

  private get adminStore(): CwaAdminStoreInterface {
    return this._adminStore
  }

  private get resourcesStore(): CwaResourcesStoreInterface {
    return this._resourcesStore
  }
}

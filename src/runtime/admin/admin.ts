import mitt from 'mitt'
import type { Emitter } from 'mitt'
import { shallowReactive, watch } from 'vue'
import throttle from 'lodash-es/throttle'
import type { DebouncedFunc } from 'lodash-es/debounce'
import type { AdminStore, CwaAdminStoreInterface } from '../storage/stores/admin/admin-store'
import type { ResourcesStore } from '../storage/stores/resources/resources-store'
import type { Resources } from '../resources/resources'
import ResourceStackManager from './resource-stack-manager'

export type ReorderEvent = {
  positionIri: string
  location: 'previous' | 'next' | number
}

type Events = {
  redrawFocus: undefined
  manageableComponentMounted: string
  componentMounted: string
  componentUpdated: string
  selectResource: string
  reorder: ReorderEvent
}

export default class Admin {
  private readonly stackManagerInstance: ResourceStackManager
  private readonly emitter: Emitter<Events>
  private throttledRedrawEmitFn: undefined | DebouncedFunc<() => void>
  private readonly _adminStore: CwaAdminStoreInterface
  private readonly mountedComponentGroups = shallowReactive(new Map<string, number>())

  public constructor(adminStoreDefinition: AdminStore, resourcesStoreDefinition: ResourcesStore, resources: Resources) {
    this.emitter = mitt<Events>()
    this.stackManagerInstance = new ResourceStackManager(adminStoreDefinition, resourcesStoreDefinition, resources)
    this.emitRedraw = this.emitRedraw.bind(this)
    this.redrawListen()
    this._adminStore = adminStoreDefinition.useStore()
  }

  public get eventBus() {
    return this.emitter
  }

  public get resourceStackManager() {
    return this.stackManagerInstance
  }

  public emptyStack() {
    this.resourceStackManager.completeStack({ clickTarget: window }, false)
    this.resourceStackManager.showManager.value = false
  }

  public toggleEdit(editing?: boolean): void {
    if (editing === false || (editing === undefined && this.isEditing)) {
      this.emptyStack()
    }
    this.adminStore.toggleEdit(editing)
  }

  public registerMountedComponentGroup(iri: string): () => void {
    this.mountedComponentGroups.set(iri, (this.mountedComponentGroups.get(iri) ?? 0) + 1)
    let released = false
    return () => {
      if (released) {
        return
      }
      released = true
      const count = (this.mountedComponentGroups.get(iri) ?? 1) - 1
      if (count > 0) {
        this.mountedComponentGroups.set(iri, count)
        return
      }
      this.mountedComponentGroups.delete(iri)
    }
  }

  public isComponentGroupMounted(iri: string): boolean {
    return this.mountedComponentGroups.has(iri)
  }

  public setNavigationGuardDisabled(disabled: boolean) {
    this.adminStore.state.navigationGuardDisabled = disabled
  }

  public get navigationGuardDisabled() {
    return this.adminStore.state.navigationGuardDisabled
  }

  public get isEditing() {
    return this.adminStore.state.isEditing
  }

  private get adminStore() {
    return this._adminStore
  }

  private redrawListen() {
    this.eventBus.on('componentMounted', this.emitRedraw)
    this.eventBus.on('manageableComponentMounted', this.emitRedraw)
    watch(() => ([
      this.resourceStackManager.showManager.value,
      this.resourceStackManager.isEditingLayout.value,
    ]), this.emitRedraw)
  }

  public emitRedraw() {
    if (!this.throttledRedrawEmitFn) {
      this.throttledRedrawEmitFn = throttle(this.doEmitRedraw, 40, {
        leading: true,
        trailing: true,
      })
    }
    this.throttledRedrawEmitFn()
  }

  private doEmitRedraw() {
    this.eventBus.emit('redrawFocus')
  }
}

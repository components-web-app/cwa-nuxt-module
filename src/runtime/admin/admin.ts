import mitt, { type Emitter } from 'mitt'
import { AdminStore } from '../storage/stores/admin/admin-store'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { Resources } from '../resources/resources'
import ResourceStackManager from './resource-stack-manager'

export type ReorderEvent = {
  positionIri: string
  location: 'previous'|'next'|number
}

type Events = {
  manageableComponentMounted: string
  componentMounted: string
  selectResource: string
  reorder: ReorderEvent
}

export default class Admin {
  private readonly stackManagerInstance: ResourceStackManager
  private readonly emitter: Emitter<Events>

  public constructor (private readonly adminStoreDefinition: AdminStore, private readonly resourcesStoreDefinition: ResourcesStore, resources: Resources) {
    this.emitter = mitt<Events>()
    this.stackManagerInstance = new ResourceStackManager(this.adminStoreDefinition, this.resourcesStoreDefinition, resources)
  }

  public get eventBus () {
    return this.emitter
  }

  public get resourceStackManager () {
    return this.stackManagerInstance
  }

  public emptyStack () {
    this.resourceStackManager.completeStack({ clickTarget: window }, false)
  }

  public toggleEdit (editing?: boolean): void {
    if (editing === false || (editing === undefined && this.isEditing)) {
      this.emptyStack()
    }
    this.adminStore.toggleEdit(editing)
  }

  public setNavigationGuardDisabled (disabled: boolean) {
    this.adminStore.state.navigationGuardDisabled = disabled
  }

  public get navigationGuardDisabled () {
    return this.adminStore.state.navigationGuardDisabled
  }

  public get isEditing () {
    return this.adminStore.state.isEditing
  }

  private get adminStore () {
    return this.adminStoreDefinition.useStore()
  }
}
